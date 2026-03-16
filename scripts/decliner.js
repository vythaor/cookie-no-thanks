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

        const strategyNames = [
            'clickDeclineButton',
            'clickNecessaryOnlyButton',
            'disableTogglesAndSave',
            'handleManageAndDisableFlow',
            'clickCloseButton',
            'removeDirectly'
        ];
        const strategies = [
            () => this.clickDeclineButton(banner),
            () => this.clickNecessaryOnlyButton(banner),
            () => this.disableTogglesAndSave(banner),
            () => this.handleManageAndDisableFlow(banner),
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

    // ─── Two-step flow helpers ────────────────────────────────────────────────

    /**
     * Simple promise-based delay
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Find the "Manage preferences / Customize" button within a banner.
     * Deliberately excludes buttons that accept, save, or reject so we
     * don't accidentally trigger other strategies.
     */
    findManageButton(banner) {
        const skipWords = ['save', 'confirm', 'accept', 'allow', 'reject', 'decline', 'deny', 'refuse', 'close', 'dismiss'];
        const buttons = banner.querySelectorAll('button, a[role="button"], [role="button"]');

        for (const btn of buttons) {
            if (!this.isVisible(btn)) continue;

            const text = (
                btn.innerText || btn.textContent ||
                btn.getAttribute('aria-label') || btn.getAttribute('title') || ''
            ).toLowerCase().trim();

            // Skip if it looks like an accept / save / reject action
            if (skipWords.some(w => text.includes(w))) continue;

            const matchesManage = COOKIE_SELECTORS.manageButtons.some(pattern => {
                if (pattern.startsWith('[')) {
                    try { return btn.matches(pattern); } catch { return false; }
                }
                return text.includes(pattern.toLowerCase());
            });

            // Also catch collapsed expanders (aria-expanded="false") even if text didn't match
            const isCollapsedToggler = btn.getAttribute('aria-expanded') === 'false';

            if (matchesManage || isCollapsedToggler) {
                console.log('[Cookie Auto Decliner] Found manage/customize button:', {
                    text: text.slice(0, 60),
                    tag: btn.tagName,
                    id: btn.id || '(no id)'
                });
                return btn;
            }
        }
        return null;
    }

    /**
     * Uncheck all opt-in checkboxes and disable aria-checked toggle switches.
     * Skips disabled inputs (which are typically for strictly necessary cookies).
     * Returns true if any toggle was changed.
     */
    disableAllToggles(container) {
        let disabledAny = false;

        // Standard checkboxes
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
            if (cb.disabled) continue; // essential — can't opt out
            if (cb.checked) {
                cb.click();
                disabledAny = true;
                console.log('[Cookie Auto Decliner] Unchecked checkbox:', cb.id || cb.name || '(unnamed)');
            }
        }

        // Custom ARIA toggle switches
        const ariaToggles = container.querySelectorAll(
            '[role="switch"][aria-checked="true"], [role="checkbox"][aria-checked="true"]'
        );
        for (const toggle of ariaToggles) {
            if (!this.isVisible(toggle)) continue;
            // Skip if it looks like an essential / required toggle (often labelled)
            const label = (toggle.getAttribute('aria-label') || toggle.textContent || '').toLowerCase();
            const isEssential = ['essential', 'necessary', 'required', 'strictly'].some(w => label.includes(w));
            if (isEssential) continue;

            toggle.click();
            disabledAny = true;
            console.log('[Cookie Auto Decliner] Disabled ARIA toggle:', label.slice(0, 60) || '(unlabelled)');
        }

        return disabledAny;
    }

    /**
     * Find a save/confirm button using the saveButtons pattern list.
     * Searches the given container; falls back to document.body.
     */
    findSaveButton(container) {
        const { button } = this.findButtonWithPattern(container, COOKIE_SELECTORS.saveButtons);
        if (button) return button;
        // Widen search if not found inside the banner
        if (container !== document.body) {
            const { button: bodyBtn } = this.findButtonWithPattern(document.body, COOKIE_SELECTORS.saveButtons);
            return bodyBtn;
        }
        return null;
    }

    /**
     * Strategy 3: If the banner already has visible (or aria-hidden) toggles,
     * disable them all and click the save button.
     * Handles inline expansion patterns (the toggles are in the DOM but hidden).
     */
    async disableTogglesAndSave(banner) {
        // Search including aria-hidden children (they may be toggled visible later)
        const disabledAny = this.disableAllToggles(banner);
        if (!disabledAny) return false;

        await this.wait(200);

        const saveBtn = this.findSaveButton(banner);
        if (saveBtn) {
            console.log('[Cookie Auto Decliner] Clicking save button after disabling inline toggles');
            this.simulateClick(saveBtn);
            return true;
        }

        console.log('[Cookie Auto Decliner] Disabled toggles but no save button found yet (will try manage flow next)');
        return false;
    }

    /**
     * Strategy 4: Click the "Manage preferences" button, wait for the panel
     * to appear, disable all opt-in toggles, then click save.
     * Also re-runs disableAllToggles on document.body to catch panels injected
     * outside the original banner element.
     */
    async handleManageAndDisableFlow(banner) {
        const manageBtn = this.findManageButton(banner);
        if (!manageBtn) {
            console.log('[Cookie Auto Decliner] No manage button found, skipping two-step flow');
            return false;
        }

        console.log('[Cookie Auto Decliner] Clicking manage/customize button to expand preferences panel');
        this.simulateClick(manageBtn);

        // Wait for the panel to expand / be injected into the DOM
        await this.wait(700);

        // Disable toggles — check inside banner first, then full page
        let disabledAny = this.disableAllToggles(banner);
        if (!disabledAny) {
            disabledAny = this.disableAllToggles(document.body);
        }

        if (disabledAny) {
            await this.wait(200);
        }

        // Look for a save button — inside banner, then full page
        const saveBtn = this.findSaveButton(banner);
        if (saveBtn) {
            console.log('[Cookie Auto Decliner] Clicking save button after manage + disable flow');
            this.simulateClick(saveBtn);
            return true;
        }

        // If we at least disabled some toggles, consider it a partial win
        // (the page's own periodic save may pick up the unchecked state)
        if (disabledAny) {
            console.log('[Cookie Auto Decliner] Disabled toggles via manage flow (no save button found)');
            return true;
        }

        return false;
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