// Cookie banner detection module
class CookieBannerDetector {
    constructor() {
        this.detectedBanners = new Set();
    }

    /**
     * Main detection function - finds all cookie banners on the page
     * @returns {Array} Array of detected banner elements
     */
    detectBanners() {
        const banners = [];

        // Method 1: Check known selectors
        const knownBanners = this.detectByKnownSelectors();
        banners.push(...knownBanners);

        // Method 2: Check high z-index elements
        const zIndexBanners = this.detectByZIndex();
        banners.push(...zIndexBanners);

        // Method 3: Check by keywords in text content
        const keywordBanners = this.detectByKeywords();
        banners.push(...keywordBanners);

        // Remove duplicates and hidden elements
        const uniqueBanners = this.removeDuplicates(banners);
        const visibleBanners = uniqueBanners.filter(banner => this.isVisible(banner));

        return visibleBanners;
    }

    /**
     * Detect banners using predefined selectors
     */
    detectByKnownSelectors() {
        const banners = [];

        COOKIE_SELECTORS.containers.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (this.isLikelyCookieBanner(element)) {
                        banners.push(element);
                    }
                });
            } catch (e) {
                // Invalid selector, skip
            }
        });

        return banners;
    }

    /**
     * Detect banners by high z-index (popups typically have high z-index)
     */
    detectByZIndex() {
        const banners = [];
        const allElements = document.querySelectorAll('div, aside, section, dialog');

        allElements.forEach(element => {
            const zIndex = parseInt(window.getComputedStyle(element).zIndex);

            if (zIndex >= HIGH_Z_INDEX_THRESHOLD) {
                const text = element.innerText.toLowerCase();

                // Check if text content suggests it's a cookie banner
                if (this.containsCookieKeywords(text)) {
                    banners.push(element);
                }
            }
        });

        return banners;
    }

    /**
     * Detect banners by searching for cookie-related keywords in visible elements
     */
    detectByKeywords() {
        const banners = [];
        const candidates = document.querySelectorAll('div[role="dialog"], div[role="alertdialog"], aside, section');

        candidates.forEach(element => {
            // Skip if already detected
            if (this.detectedBanners.has(element)) return;

            const text = element.innerText.toLowerCase();
            const className = element.className.toLowerCase();
            const id = element.id.toLowerCase();

            // Check for cookie keywords in text
            const hasCookieText = this.containsCookieKeywords(text);

            // Check for cookie keywords in attributes
            const hasCookieAttributes =
                COOKIE_INDICATORS.classKeywords.some(keyword => className.includes(keyword)) ||
                COOKIE_INDICATORS.idKeywords.some(keyword => id.includes(keyword));

            if ((hasCookieText && text.length > 20) || hasCookieAttributes) {
                if (this.isLikelyCookieBanner(element)) {
                    banners.push(element);
                }
            }
        });

        return banners;
    }

    /**
     * Check if text contains cookie-related keywords
     */
    containsCookieKeywords(text) {
        const cookieKeywords = [
            'cookie', 'cookies', 'consent', 'privacy', 'gdpr',
            'we use cookies', 'this website uses', 'accept cookies',
            'by continuing', 'data protection'
        ];

        return cookieKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Verify if element is likely a cookie banner
     */
    isLikelyCookieBanner(element) {
        // Must be visible
        if (!this.isVisible(element)) return false;

        // Should have reasonable size
        const rect = element.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 50) return false;

        // Should contain interactive elements (buttons)
        const hasButtons = element.querySelectorAll('button, a[role="button"], input[type="button"]').length > 0;
        if (!hasButtons) return false;

        // Check text content
        const text = element.innerText.toLowerCase();
        if (!this.containsCookieKeywords(text)) return false;

        return true;
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);

        // Check display and visibility
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;

        // Check if element has dimensions
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        return true;
    }

    /**
     * Remove duplicate elements (child elements that are already captured by parent)
     */
    removeDuplicates(banners) {
        const unique = [];

        banners.forEach(banner => {
            // Check if this banner is a child of any existing banner
            const isChild = unique.some(existing => existing.contains(banner));

            if (!isChild) {
                // Remove any existing banners that are children of this one
                const filtered = unique.filter(existing => !banner.contains(existing));
                unique.length = 0;
                unique.push(...filtered, banner);
            }
        });

        return unique;
    }

    /**
     * Mark banner as detected to avoid re-processing
     */
    markAsDetected(banner) {
        this.detectedBanners.add(banner);
    }

    /**
     * Find overlays/backdrops associated with cookie banners
     */
    findOverlays() {
        const overlays = [];

        COOKIE_SELECTORS.overlays.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (this.isVisible(element)) {
                        overlays.push(element);
                    }
                });
            } catch (e) {
                // Invalid selector, skip
            }
        });

        return overlays;
    }
}

// Create global instance
const cookieBannerDetector = new CookieBannerDetector();