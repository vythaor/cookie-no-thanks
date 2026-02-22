// Cookie banner auto-decline module
class CookieDecliner {
    constructor() {
        this.processedBanners = new Set();
        this.stats = {
            declined: 0,
            closed: 0
        };
    }

    /**
     * Log banner element info for debugging
     */
    logBannerInfo(banner, label) {
        const tag = banner.tagName?.toLowerCase() || '?';
        const id = banner.id || '(no id)';
        const cls = (banner.className && typeof banner.className === 'string') ? banner.className.trim().slice(0, 80) : '(no class)';
        const text = (banner.innerText || banner.textContent || '').trim().slice(0, 200);
        console.log(`[Cookie Auto Decliner] ${label}:`, {
            tag,
            id,
            class: cls,
            textPreview: text ? text.replace(/\s+/g, ' ') : '(no text)'
        });
    }

    /**
     * Main function to decline cookies in a banner
     * @param {HTMLElement} banner - The detected banner element
     * @returns {boolean} - True if successfully declined
     */
    async declineCookies(banner) {
        if (this.processedBanners.has(banner)) {
            console.log('[Cookie Auto Decliner] Skipping already processed banner');
            return false;
        }
        console.log('declined cookie', banner);
        this.processedBanners.add(banner);
        this.logBannerInfo(banner, 'Cookie popup to process');

        const strategyNames = ['clickDeclineButton', 'clickNecessaryOnlyButton', 'clickCloseButton', 'removeDirectly'];
        const strategies = [
            () => this.clickDeclineButton(banner),
            () => this.clickNecessaryOnlyButton(banner),
            () => this.clickCloseButton(banner),
            () => this.removeDirectly(banner)
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const success = await strategies[i]();
                if (success) {
                    this.stats.declined++;
                    this.removeOverlays();
                    this.restorePageScroll();
                    console.log('[Cookie Auto Decliner] Strategy succeeded:', strategyNames[i]);
                    console.log('[Cookie Auto Decliner] Cookie banner declined successfully');
                    console.log('[Cookie Auto Decliner] If the cookie popup is still visible, the site may not have reacted to the click.');
                    return true;
                }
            } catch (error) {
                console.error('[Cookie Auto Decliner] Strategy failed:', strategyNames[i], error);
            }
        }

        console.log('[Cookie Auto Decliner] No strategy succeeded for this banner');
        return false;
    }

    /**
     * Try to find and click a "Decline/Reject" button
     */
    clickDeclineButton(banner) {
        const { button, matchedPattern } = this.findButtonWithPattern(banner, COOKIE_SELECTORS.declineButtons);
        if (button) {
            const btnText = (button.innerText || button.textContent || button.value || '').trim().slice(0, 60);
            console.log('[Cookie Auto Decliner] Reject button clicked:', {
                matchedPattern,
                buttonText: btnText,
                tag: button.tagName,
                id: button.id || '(no id)',
                class: (button.className && String(button.className).slice(0, 60)) || '(no class)'
            });
            this.simulateClick(button);
            return true;
        }

        return false;
    }

    /**
     * Try to find and click a "Necessary Only" button
     */
    clickNecessaryOnlyButton(banner) {
        const { button, matchedPattern } = this.findButtonWithPattern(banner, COOKIE_SELECTORS.necessaryOnlyButtons);

        if (button) {
            const btnText = (button.innerText || button.textContent || button.value || '').trim().slice(0, 60);
            console.log('[Cookie Auto Decliner] Necessary-only button clicked:', {
                matchedPattern,
                buttonText: btnText
            });
            this.simulateClick(button);
            return true;
        }

        return false;
    }

    /**
     * Try to find and click a close button
     */
    clickCloseButton(banner) {
        const closeSelectors = COOKIE_SELECTORS.closeButtons;

        for (const selector of closeSelectors) {
            try {
                const button = banner.querySelector(selector);
                if (button && this.isVisible(button)) {
                    console.log('[Cookie Auto Decliner] Close button clicked:', { selector, tag: button.tagName });
                    this.simulateClick(button);
                    return true;
                }
            } catch (e) {
                // Invalid selector, continue
            }
        }

        return false;
    }

    /**
     * Last resort: directly remove the banner from DOM
     */
    removeDirectly(banner) {
        console.log('Removing banner directly from DOM');
        banner.style.display = 'none';
        banner.remove();
        this.stats.closed++;
        return true;
    }

    /**
     * Find a button matching any of the given patterns; returns button and which pattern matched (for logging).
     */
    findButtonWithPattern(banner, patterns) {
        try {
            if (!banner || typeof banner.querySelectorAll !== 'function') {
                return { button: null, matchedPattern: null };
            }
            const buttons = banner.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]');

            for (const button of buttons) {
                if (!this.isVisible(button)) continue;

                const rawText = (button.innerText ?? button.textContent ?? button.value ?? '').toString();
                const buttonText = rawText.toLowerCase().trim();
                const ariaLabel = (button.getAttribute('aria-label') ?? '').toString().toLowerCase();
                const title = (button.getAttribute('title') ?? '').toString().toLowerCase();

                for (const pattern of patterns) {
                    if (typeof pattern === 'string' && !pattern.startsWith('[')) {
                        const patternLower = pattern.toLowerCase();
                        if (buttonText.includes(patternLower) ||
                            ariaLabel.includes(patternLower) ||
                            title.includes(patternLower)) {
                            console.log('[Cookie Auto Decliner] Pattern matched (decline/necessary):', {
                                pattern,
                                detectedText: { buttonText: buttonText.slice(0, 60), ariaLabel: ariaLabel.slice(0, 60), title: title.slice(0, 60) }
                            });
                            return { button, matchedPattern: pattern };
                        }
                    }
                }
            }

            for (const pattern of patterns) {
                if (typeof pattern === 'string' && pattern.startsWith('[')) {
                    try {
                        const element = banner.querySelector(pattern);
                        if (element && this.isVisible(element)) {
                            console.log('[Cookie Auto Decliner] Pattern matched (selector):', { pattern });
                            return { button: element, matchedPattern: pattern };
                        }
                    } catch (e) {
                        // Invalid selector, continue
                    }
                }
            }
        } catch (err) {
            console.error('[Cookie Auto Decliner] findButtonWithPattern error:', err);
        }
        return { button: null, matchedPattern: null };
    }

    /**
     * Find a button matching any of the given patterns (legacy API)
     */
    findButton(banner, patterns) {
        const { button } = this.findButtonWithPattern(banner, patterns);
        return button;
    }

    /**
     * Simulate a human-like click on an element
     */
    simulateClick(element) {
        // Try multiple click methods for compatibility

        // Method 1: Standard click
        element.click();

        // Method 2: Dispatch mouse events (for frameworks that listen to these)
        setTimeout(() => {
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(event);
            });
        }, 100);
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        return true;
    }

    /**
     * Remove overlay/backdrop elements
     */
    removeOverlays() {
        const overlays = cookieBannerDetector.findOverlays();
        overlays.forEach(overlay => {
            overlay.style.display = 'none';
            overlay.remove();
        });
    }

    /**
     * Restore page scrolling (some banners disable it)
     */
    restorePageScroll() {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // Remove scroll-blocking classes
        const scrollBlockClasses = ['no-scroll', 'modal-open', 'overflow-hidden'];
        scrollBlockClasses.forEach(className => {
            document.body.classList.remove(className);
            document.documentElement.classList.remove(className);
        });
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats.declined = 0;
        this.stats.closed = 0;
    }
}

// Create global instance
const cookieDecliner = new CookieDecliner();