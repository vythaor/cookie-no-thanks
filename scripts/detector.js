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

        // Method 2: Check by stacking context (z-index OR position:fixed/sticky)
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
     * Walk up the DOM tree to find the nearest ancestor with a real numeric z-index.
     * Returns 0 if none found (element uses the default "auto" stacking context).
     * This is needed because static/relative elements often have zIndex === "auto",
     * which parseInt() turns into NaN — causing the threshold check to silently fail.
     * @param {Element} element
     * @returns {number}
     */
    getEffectiveZIndex(element) {
        let el = element;
        while (el && el !== document.documentElement) {
            const z = parseInt(window.getComputedStyle(el).zIndex, 10);
            if (!isNaN(z)) return z;
            el = el.parentElement;
        }
        return 0;
    }

    /**
     * Determine whether an element is a stacking candidate for cookie-banner detection.
     * Two conditions qualify:
     *   1. The element (or any ancestor) has a numeric z-index >= HIGH_Z_INDEX_THRESHOLD, OR
     *   2. The element is position:fixed or position:sticky — many cookie bars sit at the
     *      bottom of the viewport using fixed/sticky positioning with no explicit z-index set.
     * @param {Element} element
     * @returns {boolean}
     */
    isStackingCandidate(element) {
        const style = window.getComputedStyle(element);
        const pos = style.position;

        // position:fixed or position:sticky = in-flow overlay regardless of z-index value
        if (pos === 'fixed' || pos === 'sticky') return true;

        // Walk up the DOM for a real numeric z-index
        return this.getEffectiveZIndex(element) >= HIGH_Z_INDEX_THRESHOLD;
    }

    /**
     * Detect banners by stacking context.
     * Replaces the previous "zIndex >= threshold" check, which missed:
     *   • static/relative banners where getComputedStyle returns "auto" → NaN
     *   • position:fixed bottom bars that never set a numeric z-index
     */
    detectByZIndex() {
        const banners = [];
        const allElements = document.querySelectorAll('div, aside, section, dialog');

        allElements.forEach(element => {
            if (!this.isStackingCandidate(element)) return;

            // Even a fixed/high-z element must not be a structural page component.
            // Sidebars and navigation panels can be position:fixed too.
            if (this.isStructuralFalsePositive(element)) return;

            const text = (element.innerText || element.textContent || '').toLowerCase();
            if (!this.containsCookieKeywords(text)) return;

            // Use offsetWidth/offsetHeight as layout-independent fallback (getBoundingClientRect
            // returns 0×0 for visibility:hidden elements even when they have real layout size)
            const rect = element.getBoundingClientRect();
            const w = rect.width || element.offsetWidth;
            const h = rect.height || element.offsetHeight;
            if (w < 200 || h < 50) return;

            const effectiveZ = this.getEffectiveZIndex(element);
            const pos = window.getComputedStyle(element).position;
            this.logDetectedBanner(element, 'z-index / position', { effectiveZ, position: pos });
            banners.push(element);
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
            // <aside> and <section> are intentionally excluded here — they are structural page
            // elements (sidebars, navigation panels, content sections) that frequently contain
            // words like "analytics", "preferences", or "privacy" as part of their normal UI,
            // causing false positives on dashboards like Cloudflare, Google Analytics, etc.
            // They are still reachable via Method 1 (known framework selectors) and Method 2
            // (z-index / fixed position), both of which apply stricter pre-qualification.
            // Divs/navs/footers with cookie/consent/gdpr/privacy in class or id
            'div[class*="cookie"]', 'div[id*="cookie"]',
            'div[class*="cookies"]', 'div[id*="cookies"]',
            'div[class*="consent"]', 'div[id*="consent"]',
            'div[class*="gdpr"]', 'div[id*="gdpr"]',
            'div[class*="privacy"]', 'div[id*="privacy"]',
            'nav[class*="cookie"]', 'nav[id*="cookie"]',
            'footer[class*="cookie"]',
            // <aside> and <section> are allowed ONLY when they carry an explicit cookie/consent
            // attribute — a structural element that happens to mention "analytics" in its nav
            // text is not a cookie banner
            'aside[class*="cookie"]', 'aside[id*="cookie"]',
            'aside[class*="consent"]', 'aside[id*="consent"]',
            'section[class*="cookie"]', 'section[id*="cookie"]',
            'section[class*="consent"]', 'section[id*="consent"]'
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
     * Classify all buttons in a banner by their consent intent.
     * Returns { acceptButtons, rejectButtons, necessaryButtons, manageButtons, payButtons }
     * so callers can make nuanced decisions about which action to take.
     * @param {Element} element
     * @returns {Object}
     */
    classifyButtons(element) {
        const acceptKeywords = ['accept all', 'allow all', 'agree to all', 'accept cookies', 'allow cookies', 'i agree', 'agree and proceed'];
        const rejectAllKws = ['reject all', 'decline all', 'deny all', 'refuse all', 'disallow all'];
        const rejectKws = ['reject', 'decline', 'deny', 'refuse', 'no thanks', 'opt out', 'disallow', 'do not accept', "don't accept", 'not now'];
        const necessaryKws = ['necessary only', 'essential only', 'required only', 'accept necessary', 'accept essential', 'strictly necessary', 'only necessary', 'continue without'];
        const manageKws = ['manage', 'settings', 'customize', 'customise', 'preferences', 'options', 'more options', 'let me choose'];
        const payKws = ['subscribe', 'subscription', 'pay', 'purchase', 'buy', 'premium', 'membership'];

        const result = {
            acceptButtons: [],
            rejectAllButtons: [],
            rejectButtons: [],
            necessaryButtons: [],
            manageButtons: [],
            payButtons: []
        };

        const buttons = element.querySelectorAll(
            'button, a[role="button"], input[type="button"], input[type="submit"], [role="button"]'
        );

        for (const btn of buttons) {
            // Only skip display:none — visibility:hidden buttons inside the banner can still
            // be interacted with (the banner itself controls visibility)
            if (window.getComputedStyle(btn).display === 'none') continue;

            const btnText = (
                btn.innerText || btn.textContent || btn.value ||
                btn.getAttribute('aria-label') || btn.getAttribute('title') || ''
            ).toLowerCase().trim();

            if (payKws.some(kw => btnText.includes(kw))) { result.payButtons.push(btn); continue; }
            if (rejectAllKws.some(kw => btnText.includes(kw))) { result.rejectAllButtons.push(btn); continue; }
            if (necessaryKws.some(kw => btnText.includes(kw))) { result.necessaryButtons.push(btn); continue; }
            if (rejectKws.some(kw => btnText.includes(kw))) { result.rejectButtons.push(btn); continue; }
            if (manageKws.some(kw => btnText.includes(kw))) { result.manageButtons.push(btn); continue; }
            if (acceptKeywords.some(kw => btnText.includes(kw))) { result.acceptButtons.push(btn); continue; }
        }

        return result;
    }

    /**
     * Determine whether the banner is a "pay-wall or accept" scenario:
     * the only non-accept option is to pay/subscribe.  In this case the
     * least-invasive action is to Accept (not to pay).
     * @param {Object} classified - result of classifyButtons()
     * @returns {boolean}
     */
    isPayOrAcceptBanner(classified) {
        const hasNonPayAlternative =
            classified.rejectAllButtons.length > 0 ||
            classified.rejectButtons.length > 0 ||
            classified.necessaryButtons.length > 0 ||
            classified.manageButtons.length > 0;

        return (
            classified.acceptButtons.length > 0 &&
            classified.payButtons.length > 0 &&
            !hasNonPayAlternative
        );
    }

    /**
     * Check if element has BOTH an accept-type and a reject-type button.
     * This catches banners like "Allow all" / "Reject all" that may not
     * mention the word "cookie" anywhere in their body text.
     * Delegates to classifyButtons() so the logic stays in one place.
     */
    hasAcceptAndRejectButtons(element) {
        const classified = this.classifyButtons(element);
        return (
            classified.acceptButtons.length > 0 &&
            (classified.rejectAllButtons.length > 0 || classified.rejectButtons.length > 0)
        );
    }

    /**
     * Keywords that are strong, unambiguous signals of a cookie consent popup.
     * A single match here is sufficient evidence — these phrases don't appear in
     * normal navigation, sidebar, or dashboard UI copy.
     */
    containsStrongCookieKeywords(text) {
        const strongKeywords = [
            'we use cookies',
            'this website uses cookies',
            'this site uses cookies',
            'our website uses cookies',
            'accept cookies',
            'reject cookies',
            'cookie consent',
            'cookie policy',
            'cookie notice',
            'cookie preferences',
            'manage cookies',
            'gdpr',
            'data protection',
            'personal data',
            'by continuing to browse',
            'by continuing to use this',
            'by clicking accept',
            'by clicking agree',
            'third-party cookies',
            'third party cookies',
            'targeted advertising',
            'legitimate interest'
        ];
        return strongKeywords.some(kw => text.includes(kw));
    }

    /**
     * Keywords that are weak / incidental signals — commonly found in navigation,
     * dashboards, and sidebars (e.g. "Analytics & logs", "Privacy settings" menu item,
     * "Preferences" account page).  A match here only contributes to detection when
     * combined with other evidence (consent buttons, cookie-specific attributes, etc.).
     */
    containsWeakCookieKeywords(text) {
        const weakKeywords = [
            'cookie', 'cookies', 'consent', 'privacy',
            'tracking', 'analytics', 'advertising', 'preferences',
            'third-party', 'third party', 'targeted'
        ];
        return weakKeywords.some(kw => text.includes(kw));
    }

    /**
     * Legacy combined check — still used by detectByZIndex() where the element
     * has already passed a structural pre-filter (high z-index / fixed position),
     * making a single keyword match meaningful.
     */
    containsCookieKeywords(text) {
        return this.containsStrongCookieKeywords(text) || this.containsWeakCookieKeywords(text);
    }

    /**
     * Return true if the element looks like a structural page component that should
     * never be treated as a cookie banner, regardless of its text content.
     *
     * Catches: sidebars, navigation panels, app shells, dashboards.
     * The Cloudflare <aside> false positive is a canonical example — it contains
     * "Analytics & logs" in its nav text, triggering the old keyword check.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isStructuralFalsePositive(element) {
        const tag = element.tagName.toLowerCase();
        const role = (element.getAttribute('role') || '').toLowerCase();
        const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

        // Structural semantic tags used for page chrome — never a popup
        const structuralTags = new Set(['nav', 'header', 'footer', 'main', 'form']);
        if (structuralTags.has(tag)) return true;

        // <aside> and <section> without explicit cookie/consent attributes are structural
        if ((tag === 'aside' || tag === 'section') && !this.hasCookieAttribute(element)) return true;

        // Elements with navigation or complementary ARIA roles
        const structuralRoles = new Set(['navigation', 'banner', 'main', 'complementary', 'search', 'toolbar', 'menubar', 'menu', 'tree', 'listbox', 'tablist', 'application']);
        if (structuralRoles.has(role)) return true;

        // Sidebar / navigation aria-labels
        const navLabels = ['navigation', 'sidebar', 'main menu', 'primary navigation', 'secondary navigation', 'site navigation', 'account', 'dashboard'];
        if (navLabels.some(l => ariaLabel.includes(l))) return true;

        // Elements that span most of the viewport width AND height are page shells, not popups.
        // A real cookie banner is typically a bar (full-width, short height) or a centered modal
        // (limited width).  A full-page sidebar consuming >40% viewport height and >20% width
        // but not a dialog is structural.
        if (tag !== 'dialog' && role !== 'dialog' && role !== 'alertdialog') {
            const rect = element.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const coversWidth = rect.width > vw * 0.85;
            const coversHeight = rect.height > vh * 0.85;
            // Full-page coverage without dialog semantics = page shell
            if (coversWidth && coversHeight) return true;
        }

        return false;
    }

    /**
     * Return true if the element has at least one class or id attribute containing
     * a cookie/consent keyword — used to whitelist <aside> / <section> exceptions.
     * @param {Element} element
     * @returns {boolean}
     */
    hasCookieAttribute(element) {
        const cls = (element.className && typeof element.className === 'string') ? element.className.toLowerCase() : '';
        const id = element.id.toLowerCase();
        const cookieAttrs = ['cookie', 'consent', 'gdpr', 'privacy-notice', 'cookie-notice'];
        return cookieAttrs.some(a => cls.includes(a) || id.includes(a));
    }

    /**
     * Verify if element is likely a cookie banner.
     *
     * Detection requires passing ALL of:
     *   1. Not a structural false positive (sidebar, nav, page shell, etc.)
     *   2. Visible with reasonable dimensions
     *   3. Has interactive buttons
     *   4. At least ONE of:
     *      a. Contains strong cookie keywords (definitive consent copy)
     *      b. Contains weak keywords AND has consent-classified buttons
     *      c. Has both an accept-type AND a reject-type button (keyword-free banners)
     */
    isLikelyCookieBanner(element) {
        // Gate 1: Reject structural page components immediately
        if (this.isStructuralFalsePositive(element)) return false;

        // Gate 2: Must be visible
        if (!this.isVisible(element)) return false;

        // Gate 3: Reasonable dimensions
        const rect = element.getBoundingClientRect();
        const w = rect.width || element.offsetWidth;
        const h = rect.height || element.offsetHeight;
        if (w < 200 || h < 50) return false;

        // Gate 4: Must contain interactive buttons
        const hasButtons = element.querySelectorAll(
            'button, a[role="button"], input[type="button"], [role="button"]'
        ).length > 0;
        if (!hasButtons) return false;

        const text = (element.innerText || element.textContent || '').toLowerCase();

        // Path A: Strong cookie keywords — definitive consent copy, no further checks needed
        if (this.containsStrongCookieKeywords(text)) return true;

        // Classify buttons once for paths B and C
        const classified = this.classifyButtons(element);
        const hasConsentButtons =
            classified.rejectAllButtons.length > 0 ||
            classified.rejectButtons.length > 0 ||
            classified.necessaryButtons.length > 0 ||
            classified.acceptButtons.length > 0;

        // Path B: Weak keywords are only meaningful when paired with consent buttons.
        // A sidebar with "Analytics" in its nav and no accept/reject buttons is not a banner.
        if (this.containsWeakCookieKeywords(text) && hasConsentButtons) return true;

        // Path C: No cookie keywords at all, but has a clear accept+reject button pair
        // (catches "Allow all" / "Reject all" banners with zero cookie copy in body text)
        if (
            classified.acceptButtons.length > 0 &&
            (classified.rejectAllButtons.length > 0 || classified.rejectButtons.length > 0)
        ) return true;

        return false;
    }

    /**
     * Check if element is visible.
     * Accounts for visibility:hidden animation start states and aria-hidden="false" signals.
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