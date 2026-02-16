// Main content script - orchestrates cookie banner detection and declining
(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        enabled: true,
        checkInterval: 1000, // Check every second
        maxChecks: 30, // Stop checking after 30 seconds
        retryDelay: 500 // Delay before retrying
    };

    let checksPerformed = 0;
    let processedCount = 0;

    /**
     * Initialize the extension
     */
    function init() {
        console.log('Cookie Auto Decliner: Initialized');

        // Load settings from storage
        loadSettings().then(() => {
            if (CONFIG.enabled) {
                startMonitoring();
            }
        });

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.enabled) {
                CONFIG.enabled = changes.enabled.newValue;
                if (CONFIG.enabled) {
                    startMonitoring();
                }
            }
        });
    }

    /**
     * Load settings from Chrome storage
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['enabled']);
            if (result.enabled !== undefined) {
                CONFIG.enabled = result.enabled;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * Start monitoring for cookie banners
     */
    function startMonitoring() {
        // Initial check immediately
        checkAndDecline();

        // Periodic checks for dynamically loaded banners
        const intervalId = setInterval(() => {
            checksPerformed++;

            if (checksPerformed >= CONFIG.maxChecks) {
                clearInterval(intervalId);
                console.log('Cookie Auto Decliner: Stopped monitoring after max checks');
                return;
            }

            checkAndDecline();
        }, CONFIG.checkInterval);

        // Set up MutationObserver for dynamic content
        observeDOMChanges();
    }

    /**
     * Check for cookie banners and decline them
     */
    function checkAndDecline() {
        if (!CONFIG.enabled) return;

        try {
            // Detect all cookie banners
            const banners = cookieBannerDetector.detectBanners();

            if (banners.length > 0) {
                console.log(`Found ${banners.length} cookie banner(s)`);

                banners.forEach((banner, index) => {
                    // Add a small delay between processing multiple banners
                    setTimeout(() => {
                        processBanner(banner);
                    }, index * CONFIG.retryDelay);
                });
            }
        } catch (error) {
            console.error('Error checking for cookie banners:', error);
        }
    }

    /**
     * Process a single banner
     */
    async function processBanner(banner) {
        try {
            const success = await cookieDecliner.declineCookies(banner);

            if (success) {
                processedCount++;
                cookieBannerDetector.markAsDetected(banner);

                // Update badge count
                updateBadge(processedCount);

                // Send message to background script
                chrome.runtime.sendMessage({
                    type: 'BANNER_DECLINED',
                    count: processedCount,
                    url: window.location.hostname
                }).catch(() => {
                    // Ignore errors if popup is not open
                });
            }
        } catch (error) {
            console.error('Error processing banner:', error);
        }
    }

    /**
     * Update extension badge with count
     */
    function updateBadge(count) {
        chrome.runtime.sendMessage({
            type: 'UPDATE_BADGE',
            count: count
        }).catch(() => {
            // Ignore errors
        });
    }

    /**
     * Observe DOM changes for dynamically loaded banners
     */
    function observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            // Check if any new nodes contain cookie banners
            let shouldCheck = false;

            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if added node might be a cookie banner
                            const text = node.textContent?.toLowerCase() || '';
                            if (text.includes('cookie') || text.includes('consent')) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            }

            if (shouldCheck && CONFIG.enabled) {
                // Debounce: wait a bit before checking
                setTimeout(() => {
                    checkAndDecline();
                }, 500);
            }
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Handle messages from popup or background
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'GET_STATS':
                sendResponse({
                    processed: processedCount,
                    stats: cookieDecliner.getStats()
                });
                break;

            case 'MANUAL_TRIGGER':
                checkAndDecline();
                sendResponse({ success: true });
                break;

            case 'TOGGLE_ENABLED':
                CONFIG.enabled = message.enabled;
                if (CONFIG.enabled) {
                    startMonitoring();
                }
                sendResponse({ success: true });
                break;

            default:
                break;
        }

        return true;
    });

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();