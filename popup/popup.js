// Popup script for Cookie Auto Decliner

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const enableToggle = document.getElementById('enableToggle');
    const manualTrigger = document.getElementById('manualTrigger');
    const currentPageCount = document.getElementById('currentPageCount');
    const totalCount = document.getElementById('totalCount');
    const statusMessage = document.getElementById('statusMessage');
    const openOptions = document.getElementById('openOptions');

    // Load initial settings and stats
    await loadSettings();
    await loadStats();

    // Set up event listeners
    setupEventListeners();

    /**
     * Load settings from storage
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['enabled']);
            enableToggle.checked = result.enabled !== false; // Default to true
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * Load statistics
     */
    async function loadStats() {
        try {
            // Get total count from storage
            const storageResult = await chrome.storage.sync.get(['totalDeclined']);
            totalCount.textContent = storageResult.totalDeclined || 0;

            // Get current page count from content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Content script might not be loaded yet
                        currentPageCount.textContent = '0';
                        return;
                    }

                    if (response && response.processed !== undefined) {
                        currentPageCount.textContent = response.processed;
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Toggle switch
        enableToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;

            try {
                // Save to storage
                await chrome.storage.sync.set({ enabled });

                // Send message to all tabs
                const tabs = await chrome.tabs.query({});
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'TOGGLE_ENABLED',
                        enabled: enabled
                    }).catch(() => {
                        // Ignore errors for tabs without content script
                    });
                });

                showStatus(
                    enabled ? 'Auto decline enabled' : 'Auto decline disabled',
                    'success'
                );
            } catch (error) {
                console.error('Failed to toggle:', error);
                showStatus('Failed to update setting', 'error');
            }
        });

        // Manual trigger button
        manualTrigger.addEventListener('click', async () => {
            try {
                manualTrigger.disabled = true;
                manualTrigger.textContent = 'Scanning...';

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!tab || !tab.id) {
                    showStatus('No active tab found', 'error');
                    resetButton();
                    return;
                }

                // Send message to content script
                chrome.tabs.sendMessage(tab.id, { type: 'MANUAL_TRIGGER' }, (response) => {
                    if (chrome.runtime.lastError) {
                        showStatus('Please refresh the page and try again', 'error');
                        resetButton();
                        return;
                    }

                    showStatus('Scan completed', 'success');

                    // Reload stats after a short delay
                    setTimeout(() => {
                        loadStats();
                        resetButton();
                    }, 1000);
                });
            } catch (error) {
                console.error('Manual trigger failed:', error);
                showStatus('Scan failed', 'error');
                resetButton();
            }
        });

        // Options link
        openOptions.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });

        // Listen for messages from background/content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'BANNER_DECLINED') {
                loadStats();
            }
        });
    }

    /**
     * Reset manual trigger button
     */
    function resetButton() {
        manualTrigger.disabled = false;
        manualTrigger.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2V8M8 8V14M8 8H14M8 8H2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Scan Now
    `;
    }

    /**
     * Show status message
     */
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message show ${type}`;

        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
    }

    /**
     * Auto-refresh stats every few seconds
     */
    setInterval(() => {
        loadStats();
    }, 5000);
});