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

        // Generic patterns (class-based)
        '[class*="cookie-banner"]',
        '[class*="cookie-consent"]',
        '[class*="cookie-notice"]',
        '[class*="cookie-popup"]',
        '[class*="gdpr-banner"]',
        '[class*="gdpr-consent"]',
        '[class*="privacy-banner"]',
        '[class*="consent-banner"]',
        '[class*="cookie-bar"]',
        '[class*="cookies-banner"]',

        // Generic patterns (ID-based)
        '[id*="cookie-banner"]',
        '[id*="cookie-consent"]',
        '[id*="cookie-notice"]',
        '[id*="gdpr"]',
        '[id*="privacy-banner"]',

        // ARIA and semantic patterns
        '[role="dialog"][aria-label*="cookie" i]',
        '[role="dialog"][aria-label*="consent" i]',
        '[role="dialog"][aria-label*="privacy" i]'
    ],

    // Decline/Reject button patterns
    declineButtons: [
        // Direct text matching (will be used with contains selector)
        'reject all',
        'reject',
        'decline',
        'decline all',
        'deny',
        'deny all',
        'refuse',
        'refuse all',
        'no thanks',
        'no',
        'dismiss',

        // Multi-language support
        // German
        'ablehnen',
        'alle ablehnen',

        // French
        'refuser',
        'tout refuser',
        'rejeter',

        // Spanish
        'rechazar',
        'rechazar todo',
        'denegar',

        // Italian
        'rifiuta',
        'rifiuta tutto',

        // Dutch
        'weigeren',
        'alles weigeren',

        // Portuguese
        'rejeitar',
        'rejeitar tudo',

        // Class and ID patterns
        '[class*="reject"]',
        '[class*="decline"]',
        '[class*="deny"]',
        '[id*="reject"]',
        '[id*="decline"]',
        '[id*="deny"]'
    ],

    // "Necessary only" / "Essential only" patterns
    necessaryOnlyButtons: [
        'necessary only',
        'essential only',
        'required only',
        'strictly necessary',
        'save preferences',
        'confirm my choices',
        'confirm selection',

        // Multi-language
        'nur notwendige', // German
        'nécessaires uniquement', // French
        'solo necesarias', // Spanish
        'solo essenziali', // Italian
        'alleen noodzakelijk', // Dutch

        '[class*="necessary"]',
        '[class*="essential"]',
        '[class*="save-preferences"]'
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
const HIGH_Z_INDEX_THRESHOLD = 999;

// Common attributes that indicate a cookie banner
const COOKIE_INDICATORS = {
    classKeywords: ['cookie', 'consent', 'gdpr', 'privacy', 'banner', 'notice'],
    idKeywords: ['cookie', 'consent', 'gdpr', 'privacy'],
    ariaLabels: ['cookie', 'consent', 'privacy', 'notice']
};