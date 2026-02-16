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
     * Main function to decline cookies in a banner
     * @param {HTMLElement} banner - The detected banner element
     * @returns {boolean} - True if successfully declined
     */
    async declineCookies(banner) {
        if (this.processedBanners.has(banner)) {
            return false;
        }

        this.processedBanners.add(banner);

        // Try different strategies in order of preference
        const strategies = [
            () => this.clickDeclineButton(banner),
            () => this.clickNecessaryOnlyButton(banner),
            () => this.clickCloseButton(banner),
            () => this.removeDirectly(banner)
        ];

        for (const strategy of strategies) {
            try {
                const success = await strategy();
                if (success) {
                    this.stats.declined++;
                    this.removeOverlays();
                    this.restorePageScroll();
                    console.log('Cookie banner declined successfully');
                    return true;
                }
            } catch (error) {
                console.error('Strategy failed:', error);
            }
        }

        return false;
    }

    /**
     * Try to find and click a "Decline/Reject" button
     */
    clickDeclineButton(banner) {
        const button = this.findButton(banner, COOKIE_SELECTORS.declineButtons);

        if (button) {
            console.log('Found decline button:', button);
            this.simulateClick(button);
            return true;
        }

        return false;
    }

    /**
     * Try to find and click a "Necessary Only" button
     */
    clickNecessaryOnlyButton(banner) {
        const button = this.findButton(banner, COOKIE_SELECTORS.necessaryOnlyButtons);

        if (button) {
            console.log('Found necessary-only button:', button);
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
                    console.log('Found close button:', button);
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
     * Find a button matching any of the given patterns
     */
    findButton(banner, patterns) {
        // First, try to find by text content
        const buttons = banner.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]');

        for (const button of buttons) {
            if (!this.isVisible(button)) continue;

            const buttonText = button.innerText.toLowerCase().trim();
            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const title = (button.getAttribute('title') || '').toLowerCase();

            // Check if button text matches any pattern
            for (const pattern of patterns) {
                if (typeof pattern === 'string') {
                    const patternLower = pattern.toLowerCase();

                    if (buttonText.includes(patternLower) ||
                        ariaLabel.includes(patternLower) ||
                        title.includes(patternLower)) {
                        return button;
                    }
                }
            }
        }

        // Try selector-based patterns
        for (const pattern of patterns) {
            if (typeof pattern === 'string' && pattern.startsWith('[')) {
                try {
                    const element = banner.querySelector(pattern);
                    if (element && this.isVisible(element)) {
                        return element;
                    }
                } catch (e) {
                    // Invalid selector, continue
                }
            }
        }

        return null;
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