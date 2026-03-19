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

        console.log('[Cookie Auto Decliner] Found ' + visibleBanners.length + ' cookie banner(s)');

        return visibleBanners;
    }

    /**
     * Log detected banner info for debugging
     */
    logDetectedBanner(element, source, extra = {}) {
        const tag = element.tagName?.toLowerCase() || '?';
        const id = element.id || '(no id)';
        const cls = (element.className && typeof element.className === 'string') ? element.className.trim().slice(0, 80) : '(no class)';
        const text = (element.innerText || element.textContent || '').trim().slice(0, 200);
        console.log('[Cookie Auto Decliner] Cookie popup detected:', {
            source,
            tag,
            id,
            class: cls,
            textDetected: text ? text.replace(/\s+/g, ' ') : '(no text)',
            ...extra
        });
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
                        this.logDetectedBanner(element, 'known selector', { selector });
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
            const text = (element.innerText || element.textContent || '').toLowerCase();

            if (zIndex >= HIGH_Z_INDEX_THRESHOLD && this.containsCookieKeywords(text)) {
                const rect = element.getBoundingClientRect();
                if (rect.width >= 200 && rect.height >= 50) {
                    this.logDetectedBanner(element, 'z-index', { zIndex });
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
        // Cast a wide net: semantic dialog roles + common container tags +
        // any div/nav/footer whose class or id suggests a cookie/consent banner.
        const candidateSelectors = [
            'div[role="dialog"]',
            'div[role="alertdialog"]',
            // aria-modal dialogs that are explicitly NOT aria-hidden (e.g. slide-in consent modals
            // that use visibility:hidden during their CSS animation — aria-hidden="false" signals
            // the element IS presented to the user even if visibility hasn't transitioned yet)
            '[aria-modal="true"][aria-hidden="false"]',
            'aside',
            'section',
            // Divs/navs/footers with cookie/consent/gdpr/privacy in class or id
            'div[class*="cookie"]', 'div[id*="cookie"]',
            'div[class*="cookies"]', 'div[id*="cookies"]',
            'div[class*="consent"]', 'div[id*="consent"]',
            'div[class*="gdpr"]', 'div[id*="gdpr"]',
            'div[class*="privacy"]', 'div[id*="privacy"]',
            'nav[class*="cookie"]', 'nav[id*="cookie"]',
            'footer[class*="cookie"]'
        ].join(', ');
        const candidates = document.querySelectorAll(candidateSelectors);

        candidates.forEach(element => {
            // Skip if already detected
            if (this.detectedBanners.has(element)) return;

            // innerText returns "" for visibility:hidden elements; textContent is layout-agnostic
            const text = (element.innerText || element.textContent || '').toLowerCase();
            const className = element.className.toLowerCase();
            const id = element.id.toLowerCase();

            // Check for cookie keywords in text
            const hasCookieText = this.containsCookieKeywords(text);

            // Check for cookie keywords in attributes or button text (reject/accept)
            const hasCookieAttributes =
                COOKIE_INDICATORS.classKeywords.some(keyword => className.includes(keyword)) ||
                COOKIE_INDICATORS.idKeywords.some(keyword => id.includes(keyword));

            if ((hasCookieText && text.length > 20) || hasCookieAttributes) {
                if (this.isLikelyCookieBanner(element)) {
                    this.logDetectedBanner(element, 'keywords', {
                        hasCookieText,
                        hasCookieAttributes,
                        textLength: text.length
                    });
                    banners.push(element);
                }
            }
        });

        return banners;
    }

    /**
     * Check if element contains a button with consent-related text (e.g. "reject", "accept")
     */
    hasButtonsWithConsentText(element) {
        const buttons = element.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]');
        for (const btn of buttons) {
            const btnText = (btn.innerText || btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();
            if (COOKIE_INDICATORS.buttonTextKeywords.some(keyword => btnText.includes(keyword))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if element has BOTH an accept-type and a reject-type button.
     * This catches banners like "Allow all" / "Reject all" that may not
     * mention the word "cookie" anywhere in their body text.
     */
    hasAcceptAndRejectButtons(element) {
        const acceptKeywords = ['accept all', 'allow all', 'agree to all', 'accept cookies', 'allow cookies'];
        const rejectKeywords = ['reject', 'decline', 'deny', 'refuse', 'no thanks', 'opt out', 'disallow'];

        const buttons = element.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"], [role="button"]');
        let hasAccept = false;
        let hasReject = false;

        for (const btn of buttons) {
            // NOTE: we intentionally skip the isVisible() check here. Child buttons inside a
            // visibility:hidden container inherit that style, so isVisible() would reject them
            // all even though the banner itself was already validated as accessible.
            // We only exclude buttons that are explicitly display:none.
            if (window.getComputedStyle(btn).display === 'none') continue;

            // Use textContent as fallback since innerText returns "" for hidden elements
            const btnText = (
                btn.innerText || btn.textContent || btn.value ||
                btn.getAttribute('aria-label') || btn.getAttribute('title') || ''
            ).toLowerCase().trim();

            if (acceptKeywords.some(kw => btnText.includes(kw))) hasAccept = true;
            if (rejectKeywords.some(kw => btnText.includes(kw))) hasReject = true;

            if (hasAccept && hasReject) return true;
        }
        return false;
    }

    /**
     * Check if text contains cookie-related keywords
     */
    containsCookieKeywords(text) {
        const cookieKeywords = [
            'cookie', 'cookies', 'consent', 'privacy', 'gdpr',
            'we use cookies', 'this website uses', 'accept cookies',
            'by continuing', 'data protection', 'personal data',
            'tracking', 'analytics', 'advertising', 'preferences',
            'third-party', 'third party', 'targeted'
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
        // Use offsetWidth/offsetHeight as fallback for visibility:hidden elements
        const rect = element.getBoundingClientRect();
        const w = rect.width || element.offsetWidth;
        const h = rect.height || element.offsetHeight;
        if (w < 200 || h < 50) return false;

        // Should contain interactive elements (buttons)
        const hasButtons = element.querySelectorAll('button, a[role="button"], input[type="button"], [role="button"]').length > 0;
        if (!hasButtons) return false;

        // innerText returns "" for visibility:hidden elements; use textContent as fallback
        const text = (element.innerText || element.textContent || '').toLowerCase();

        // Primary check: text contains cookie/privacy keywords
        if (this.containsCookieKeywords(text)) return true;

        // Fallback: banner has both an accept AND a reject button
        // This catches "Allow all" / "Reject all" modals without cookie keywords
        if (this.hasAcceptAndRejectButtons(element)) return true;

        if (this.hasButtonsWithConsentText(element)) return true;

        return false;
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);

        if (style.display === 'none') return false;

        const ariaHiddenAttr = element.getAttribute('aria-hidden');
        const explicitlyAriaVisible = ariaHiddenAttr === 'false';

        if (style.visibility === 'hidden' && !explicitlyAriaVisible) {
            // Don't reject outright — if it has real layout dimensions it may be
            // a banner animating in (e.g. CSS transition from hidden → visible)
            const w = element.offsetWidth;
            const h = element.offsetHeight;
            if (w < 200 || h < 50) return false;
            // Fall through — treat as visible if it has real size
        }

        if (style.opacity === '0') return false;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && element.offsetWidth === 0) return false;
        if (rect.height === 0 && element.offsetHeight === 0) return false;

        return true;
    }

    /**
     * Remove duplicate elements (child elements that are already captured by parent)
     */
    removeDuplicates(banners) {
        const unique = [];
        banners.forEach(banner => {
            const isChild = unique.some(e => e.contains(banner));
            // Only deduplicate siblings if they share a cookie-related class name,
            // preventing legitimate nested panels from being dropped
            const isSiblingDuplicate = unique.some(e =>
                e.parentElement === banner.parentElement &&
                e !== banner &&
                e.className === banner.className  // same component, different instance
            );
            if (!isChild && !isSiblingDuplicate) {
                const filtered = unique.filter(e => !banner.contains(e));
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