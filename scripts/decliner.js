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
     * Main function to decline cookies in a banner.
     *
     * Strategy priority order (each tried in sequence, stops on first success):
     *   1. clickRejectAllButton       — "Reject all" / "Decline all" (most explicit)
     *   2. clickNecessaryOnlyButton   — "Accept necessary only" / "Essential only"
     *   3. clickDeclineButton         — plain "Reject" / "Decline" (no "all" qualifier)
     *   4. handleManageAndDisableFlow — open settings, disable all toggles, save
     *   5. handlePayOrAcceptBanner    — pay-wall scenario: click Accept (not pay)
     *   6. clickAcceptAsLastResort    — only one button and it accepts (no alternative)
     *   7. disableTogglesAndSave      — toggles already visible inline, disable + save
     *   8. clickCloseButton           — close/dismiss button
     *   9. removeDirectly             — DOM removal (last resort)
     *
     * @param {HTMLElement} banner - The detected banner element
     * @returns {boolean} - True if successfully handled
     */
    async declineCookies(banner) {
        if (this.processedBanners.has(banner)) {
            console.log('[Cookie Auto Decliner] Skipping already processed banner');
            return false;
        }
        this.processedBanners.add(banner);
        this.logBannerInfo(banner, 'Cookie popup to process');

        // Pre-classify all buttons once — shared by multiple strategies below
        const classified = cookieBannerDetector.classifyButtons(banner);
        console.log('[Cookie Auto Decliner] Button classification:', {
            rejectAll: classified.rejectAllButtons.map(b => this.btnLabel(b)),
            necessary: classified.necessaryButtons.map(b => this.btnLabel(b)),
            reject: classified.rejectButtons.map(b => this.btnLabel(b)),
            manage: classified.manageButtons.map(b => this.btnLabel(b)),
            accept: classified.acceptButtons.map(b => this.btnLabel(b)),
            pay: classified.payButtons.map(b => this.btnLabel(b))
        });

        const strategyNames = [
            'clickRejectAllButton',
            'clickNecessaryOnlyButton',
            'clickDeclineButton',
            'handleManageAndDisableFlow',
            'handlePayOrAcceptBanner',
            'clickAcceptAsLastResort',
            'disableTogglesAndSave',
            'clickCloseButton',
            'removeDirectly'
        ];
        const strategies = [
            () => this.clickRejectAllButton(banner, classified),
            () => this.clickNecessaryOnlyButton(banner, classified),
            () => this.clickDeclineButton(banner, classified),
            () => this.handleManageAndDisableFlow(banner, classified),
            () => this.handlePayOrAcceptBanner(banner, classified),
            () => this.clickAcceptAsLastResort(banner, classified),
            () => this.disableTogglesAndSave(banner),
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
                    console.log('[Cookie Auto Decliner] Cookie banner handled successfully');
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
     * Short readable label for a button element (used in logging)
     */
    btnLabel(btn) {
        return (btn.innerText || btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim().slice(0, 40);
    }

    // ─── Strategy 1: Reject All ───────────────────────────────────────────────

    /**
     * Click the most explicit rejection button ("Reject all", "Decline all", etc.)
     * This is the highest-priority strategy — always preferred over plain "Reject".
     */
    clickRejectAllButton(banner, classified) {
        const btn = classified.rejectAllButtons[0];
        if (!btn) return false;

        console.log('[Cookie Auto Decliner] Clicking "Reject all" button:', this.btnLabel(btn));
        this.simulateClick(btn);
        return true;
    }

    // ─── Strategy 2: Necessary Only ──────────────────────────────────────────

    /**
     * Click "Accept necessary only" / "Essential only" — saves without opt-in cookies.
     */
    clickNecessaryOnlyButton(banner, classified) {
        const btn = classified.necessaryButtons[0];
        if (!btn) {
            // Also check via COOKIE_SELECTORS pattern list as a secondary scan
            const { button, matchedPattern } = this.findButtonWithPattern(banner, COOKIE_SELECTORS.necessaryOnlyButtons);
            if (!button) return false;
            console.log('[Cookie Auto Decliner] Clicking necessary-only button (pattern):', matchedPattern);
            this.simulateClick(button);
            return true;
        }

        console.log('[Cookie Auto Decliner] Clicking necessary-only button:', this.btnLabel(btn));
        this.simulateClick(btn);
        return true;
    }

    // ─── Strategy 3: Plain Decline/Reject ────────────────────────────────────

    /**
     * Click a plain "Reject" / "Decline" button that is not "Reject all".
     * Only runs after strategies 1 and 2 have already failed — avoids accidentally
     * clicking a "Decline" button that only applies to a subset of cookies when
     * a "Decline all" or "Necessary only" option was available.
     */
    clickDeclineButton(banner, classified) {
        // Try classifyButtons result first (fast path)
        const btn = classified.rejectButtons[0];
        if (btn) {
            console.log('[Cookie Auto Decliner] Clicking reject/decline button:', this.btnLabel(btn));
            this.simulateClick(btn);
            return true;
        }

        // Fall back to full COOKIE_SELECTORS pattern scan (catches selector-based patterns)
        const { button, matchedPattern } = this.findButtonWithPattern(banner, COOKIE_SELECTORS.declineButtons);
        if (button) {
            console.log('[Cookie Auto Decliner] Clicking decline button (pattern):', matchedPattern);
            this.simulateClick(button);
            return true;
        }

        return false;
    }

    // ─── Strategy 4: Manage → Disable toggles → Save ─────────────────────────

    /**
     * Click the "Manage preferences" button, wait for the panel to appear,
     * then check for a "Reject all" inside the panel first. If not found,
     * disable all opt-in toggles and click Save.
     *
     * Also re-runs disableAllToggles on document.body to catch panels that are
     * injected outside the original banner element.
     */
    async handleManageAndDisableFlow(banner, classified) {
        const manageBtn = classified.manageButtons[0] || this.findManageButton(banner);
        if (!manageBtn) {
            console.log('[Cookie Auto Decliner] No manage button found, skipping two-step flow');
            return false;
        }

        console.log('[Cookie Auto Decliner] Clicking manage/customize button:', this.btnLabel(manageBtn));
        this.simulateClick(manageBtn);

        // Wait for the panel to expand / be injected into the DOM
        await this.wait(700);

        // Re-classify after the panel has opened — a "Reject all" button may now be visible
        const panelClassified = cookieBannerDetector.classifyButtons(document.body);
        if (panelClassified.rejectAllButtons.length > 0) {
            const rejectAllInPanel = panelClassified.rejectAllButtons[0];
            console.log('[Cookie Auto Decliner] Found "Reject all" inside expanded panel:', this.btnLabel(rejectAllInPanel));
            this.simulateClick(rejectAllInPanel);
            return true;
        }

        // No "Reject all" inside the panel — disable all toggles then save
        let disabledAny = this.disableAllToggles(banner);
        if (!disabledAny) {
            disabledAny = this.disableAllToggles(document.body);
        }

        if (disabledAny) {
            await this.wait(200);
        }

        const saveBtn = this.findSaveButton(banner);
        if (saveBtn) {
            console.log('[Cookie Auto Decliner] Clicking save button after manage + disable flow');
            this.simulateClick(saveBtn);
            return true;
        }

        // Partial win: toggles disabled but no save button found
        if (disabledAny) {
            console.log('[Cookie Auto Decliner] Disabled toggles via manage flow (no save button found)');
            return true;
        }

        return false;
    }

    // ─── Strategy 5: Pay-wall or Accept ──────────────────────────────────────

    /**
     * Handle banners that offer "Pay / Subscribe" alongside "Accept" with no reject option.
     * In this scenario, Accept is the lesser-tracking choice (no payment data collected).
     * Logs a warning so the user knows Accept was chosen due to no available reject path.
     */
    handlePayOrAcceptBanner(banner, classified) {
        if (!cookieBannerDetector.isPayOrAcceptBanner(classified)) return false;

        const acceptBtn = classified.acceptButtons[0];
        if (!acceptBtn) return false;

        console.warn('[Cookie Auto Decliner] Pay-or-accept banner detected. No reject option available — clicking Accept (not Subscribe/Pay).');
        this.simulateClick(acceptBtn);
        return true;
    }

    // ─── Strategy 6: Accept as absolute last resort ───────────────────────────

    /**
     * If the banner has only a single button and it is an Accept-type, click it.
     * This is a last-resort path for banners that give no privacy choice at all.
     */
    clickAcceptAsLastResort(banner, classified) {
        const totalActionable =
            classified.rejectAllButtons.length +
            classified.rejectButtons.length +
            classified.necessaryButtons.length +
            classified.manageButtons.length +
            classified.payButtons.length;

        // Only fire if there is genuinely no other option
        if (totalActionable > 0) return false;
        if (classified.acceptButtons.length === 0) return false;

        const acceptBtn = classified.acceptButtons[0];
        console.warn('[Cookie Auto Decliner] No reject option found — clicking Accept as last resort:', this.btnLabel(acceptBtn));
        this.simulateClick(acceptBtn);
        return true;
    }

    // ─── Strategy 7: Disable inline toggles → Save ───────────────────────────

    /**
     * If the banner already exposes toggles inline (without a manage step),
     * disable them all and click the save button.
     */
    async disableTogglesAndSave(banner) {
        const disabledAny = this.disableAllToggles(banner);
        if (!disabledAny) return false;

        await this.wait(200);

        const saveBtn = this.findSaveButton(banner);
        if (saveBtn) {
            console.log('[Cookie Auto Decliner] Clicking save button after disabling inline toggles');
            this.simulateClick(saveBtn);
            return true;
        }

        console.log('[Cookie Auto Decliner] Disabled inline toggles but no save button found');
        return false;
    }

    // ─── Strategy 8: Close button ─────────────────────────────────────────────

    /**
     * Try to find and click a close/dismiss button.
     */
    clickCloseButton(banner) {
        for (const selector of COOKIE_SELECTORS.closeButtons) {
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

    // ─── Strategy 9: DOM removal ──────────────────────────────────────────────

    /**
     * Last resort: directly remove the banner from DOM.
     */
    removeDirectly(banner) {
        console.log('[Cookie Auto Decliner] Removing banner directly from DOM');
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
     * Used as a fallback when classified.manageButtons is empty.
     */
    findManageButton(banner) {
        const skipWords = ['save', 'confirm', 'accept', 'allow', 'reject', 'decline', 'deny', 'refuse', 'close', 'dismiss'];
        const buttons = banner.querySelectorAll('button, a[role="button"], [role="button"]');

        for (const btn of buttons) {
            if (window.getComputedStyle(btn).display === 'none') continue;

            const text = (
                btn.innerText || btn.textContent ||
                btn.getAttribute('aria-label') || btn.getAttribute('title') || ''
            ).toLowerCase().trim();

            if (skipWords.some(w => text.includes(w))) continue;

            const matchesManage = COOKIE_SELECTORS.manageButtons.some(pattern => {
                if (pattern.startsWith('[')) {
                    try { return btn.matches(pattern); } catch { return false; }
                }
                return text.includes(pattern.toLowerCase());
            });

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
        if (container !== document.body) {
            const { button: bodyBtn } = this.findButtonWithPattern(document.body, COOKIE_SELECTORS.saveButtons);
            return bodyBtn;
        }
        return null;
    }

    /**
     * Find a button matching any of the given patterns.
     * Checks text content, aria-label, and title against plain-text patterns,
     * then checks selector-based patterns (those starting with "[").
     * Returns { button, matchedPattern } or { button: null, matchedPattern: null }.
     */
    findButtonWithPattern(banner, patterns) {
        try {
            if (!banner || typeof banner.querySelectorAll !== 'function') {
                return { button: null, matchedPattern: null };
            }
            const buttons = banner.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]');

            for (const button of buttons) {
                if (window.getComputedStyle(button).display === 'none') continue;

                const rawText = (button.innerText ?? button.textContent ?? button.value ?? '').toString();
                const buttonText = rawText.toLowerCase().trim();
                const ariaLabel = (button.getAttribute('aria-label') ?? '').toString().toLowerCase();
                const title = (button.getAttribute('title') ?? '').toString().toLowerCase();

                for (const pattern of patterns) {
                    if (typeof pattern === 'string' && !pattern.startsWith('[')) {
                        const patternLower = pattern.toLowerCase();
                        if (
                            buttonText.includes(patternLower) ||
                            ariaLabel.includes(patternLower) ||
                            title.includes(patternLower)
                        ) {
                            return { button, matchedPattern: pattern };
                        }
                    }
                }
            }

            // Second pass: CSS selector patterns
            for (const pattern of patterns) {
                if (typeof pattern === 'string' && pattern.startsWith('[')) {
                    try {
                        const element = banner.querySelector(pattern);
                        if (element && window.getComputedStyle(element).display !== 'none') {
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

        // Honour aria-hidden="false" on elements using visibility:hidden as an animation start state
        const ariaHiddenAttr = element.getAttribute('aria-hidden');
        const explicitlyAriaVisible = ariaHiddenAttr === 'false';
        if (style.visibility === 'hidden' && !explicitlyAriaVisible) return false;

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