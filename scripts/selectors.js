// Database of common cookie banner selectors and patterns
const COOKIE_SELECTORS = {
    // Common cookie consent frameworks
    containers: [
        // OneTrust
        '#onetrust-banner-sdk',
        '#onetrust-consent-sdk',
        '.onetrust-pc-dark-filter',

        // Cookiebot
        '#CybotCookiebotDialog',
        '.CybotCookiebotDialog',

        // Quantcast
        '#qc-cmp2-ui',
        '.qc-cmp2-container',

        // TrustArc
        '#truste-consent-track',
        '#consent-tracking',

        // Osano
        '.osano-cm-dialog',
        '.osano-cm-widget',

        // Termly
        '#termly-code-snippet-support',

        // Cookie Law Info
        '.cli-modal-backdrop',
        '#cookie-law-info-bar',

        // Didomi
        '#didomi-popup',
        '#didomi-notice',

        // Generic patterns (class-based) — singular and plural forms
        '[class*="cookie-banner"]',
        '[class*="cookies-banner"]',
        '[class*="cookie-consent"]',
        '[class*="cookies-consent"]',
        '[class*="cookie-notice"]',
        '[class*="cookies-notice"]',
        '[class*="cookie-popup"]',
        '[class*="cookies-popup"]',
        '[class*="cookie-bar"]',
        '[class*="cookies-bar"]',
        '[class*="cookie-modal"]',
        '[class*="cookies-modal"]',
        '[class*="gdpr-banner"]',
        '[class*="gdpr-consent"]',
        '[class*="privacy-banner"]',
        '[class*="consent-banner"]',
        '[class*="consent-modal"]',
        '[class*="cookie-policy"]',
        '[class*="cookies-policy"]',

        // Generic patterns (ID-based)
        '[id*="cookie-banner"]',
        '[id*="cookies-banner"]',
        '[id*="cookie-consent"]',
        '[id*="cookies-consent"]',
        '[id*="cookie-notice"]',
        '[id*="cookies-notice"]',
        '[id*="cookie-bar"]',
        '[id*="cookies-bar"]',
        '[id*="gdpr"]',
        '[id*="privacy-banner"]',
        '[id*="consent-banner"]',

        // ARIA and semantic patterns
        '[role="dialog"][aria-label*="cookie" i]',
        '[role="dialog"][aria-label*="consent" i]',
        '[role="dialog"][aria-label*="privacy" i]',

        // Dialogs that are explicitly accessible (aria-hidden="false") and modal — common in
        // slide-in / animated consent banners where visibility:hidden is used as the CSS
        // animation start state rather than a true hide signal.
        '[aria-modal="true"][aria-hidden="false"]'
    ],

    // Decline/Reject button patterns — ordered by specificity (most specific first)
    declineButtons: [
        // === PRIORITY 1: Explicit "reject all / decline all" ===
        'reject all',
        'decline all',
        'deny all',
        'refuse all',
        'disallow all',
        // Multi-language "reject all"
        'alle ablehnen',        // German
        'tout refuser',         // French
        'rechazar todo',        // Spanish
        'rifiuta tutto',        // Italian
        'alles weigeren',       // Dutch
        'rejeitar tudo',        // Portuguese
        'odrzuć wszystkie',     // Polish

        // === PRIORITY 2: "Decline non-required / non-essential" ===
        'decline non-required',
        'decline non-essential',
        'reject non-required',
        'reject non-essential',

        // === PRIORITY 3: Plain reject/decline (no "all" qualifier) ===
        'reject',
        'decline',
        'deny',
        'refuse',
        'no thanks',
        'no, thanks',
        'do not accept',
        "don't accept",
        'do not allow',
        "don't allow",
        'not now',
        'disallow',
        'opt out',
        'opt-out',
        'dismiss',
        // Multi-language plain reject
        'ablehnen',             // German
        'nicht akzeptieren',    // German alt
        'refuser',              // French
        'rejeter',              // French alt
        'je refuse',            // French alt
        'rechazar',             // Spanish
        'denegar',              // Spanish alt
        'no aceptar',           // Spanish alt
        'rifiuta',              // Italian
        'non accettare',        // Italian alt
        'weigeren',             // Dutch
        'niet accepteren',      // Dutch alt
        'rejeitar',             // Portuguese
        'não aceitar',          // Portuguese alt
        'odrzuć',               // Polish

        // Class/ID attribute patterns
        '[class*="reject"]',
        '[class*="decline"]',
        '[class*="deny"]',
        '[class*="opt-out"]',
        '[id*="reject"]',
        '[id*="decline"]',
        '[id*="deny"]',
        '[id*="opt-out"]'
    ],

    // "Necessary only" / "Essential only" patterns (direct save — no second step)
    necessaryOnlyButtons: [
        'necessary only',
        'essential only',
        'required only',
        'strictly necessary',
        'only necessary',
        'only essential',
        'use necessary',
        'use essential',
        'accept necessary',
        'accept essential',
        'accept only necessary',
        'accept only essential',
        'continue without accepting',
        'continue without agreeing',
        'continue without consent',
        // Multi-language
        'nur notwendige',           // German
        'nur erforderliche',        // German alt
        'nécessaires uniquement',   // French
        'solo necesarias',          // Spanish
        'solo essenziali',          // Italian
        'alleen noodzakelijk',      // Dutch
        'apenas necessários',       // Portuguese

        '[class*="necessary"]',
        '[class*="essential"]'
    ],

    // Buttons that SAVE the current toggle selection (used after disabling toggles)
    saveButtons: [
        'save preferences',
        'save settings',
        'save my preferences',
        'save and continue',
        'save and close',
        'save my choices',
        'save my selection',
        'confirm my choices',
        'confirm choices',
        'confirm selection',
        'confirm my selection',
        'allow selected',
        'accept selected',
        'accept selection',
        'accept current selection',
        'apply',
        'apply settings',
        'submit',
        'done',
        'update preferences',
        'update settings',
        // Multi-language
        'einstellungen speichern',  // German
        'auswahl bestätigen',       // German
        'enregistrer',              // French
        'guardar preferencias',     // Spanish
        'salva preferenze',         // Italian
        'voorkeuren opslaan',       // Dutch

        '[class*="save-preferences"]',
        '[class*="save-settings"]',
        '[class*="confirm-selection"]',
        '[class*="accept-selection"]'
    ],

    // Buttons that OPEN the preferences panel (two-step flow — step 1)
    manageButtons: [
        'manage preferences',
        'manage cookies',
        'manage settings',
        'manage consent',
        'manage options',
        'cookie settings',
        'privacy settings',
        'customize',
        'customise',
        'more options',
        'set preferences',
        'let me choose',
        'choose cookies',
        'cookie preferences',
        'privacy options',
        'options',
        // Multi-language
        'einstellungen',            // German
        'paramètres',               // French
        'configurar',               // Spanish
        'impostazioni',             // Italian
        'instellingen',             // Dutch

        '[class*="manage"]',
        '[class*="customize"]',
        '[class*="settings-toggle"]',
        '[class*="preferences-toggle"]'
    ],

    // Close button patterns
    closeButtons: [
        'button[class*="close"]',
        'button[aria-label*="close" i]',
        '[class*="close-button"]',
        '.cookie-close',
        '[title*="close" i]'
    ],

    // Backdrop/overlay patterns (elements to remove)
    overlays: [
        '.modal-backdrop',
        '.cookie-overlay',
        '[class*="cookie"][class*="overlay"]',
        '[class*="consent"][class*="overlay"]',
        '.cdk-overlay-backdrop'
    ]
};

// Patterns for identifying high z-index elements (potential popups)
// Desktop (wider screens) can have lower thresholds; mobile UIs often use higher z-index values
const HIGH_Z_INDEX_THRESHOLD = window.innerWidth > 999 ? 9999 : 999;

// Common attributes that indicate a cookie banner
const COOKIE_INDICATORS = {
    classKeywords: ['cookie', 'consent', 'gdpr', 'privacy', 'banner', 'notice', 'tracking'],
    idKeywords: ['cookie', 'consent', 'gdpr', 'privacy', 'tracking'],
    ariaLabels: ['cookie', 'consent', 'privacy', 'notice'],
    // Used to detect banners whose body text may not mention "cookie" explicitly
    // — e.g. a modal that only shows "Allow all" vs "Reject all"
    buttonTextKeywords: ['reject', 'accept', 'allow all', 'reject all', 'decline', 'deny', 'refuse', 'opt out']
};