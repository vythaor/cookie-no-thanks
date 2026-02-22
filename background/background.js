// Background service worker for Cookie Auto Decliner

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Cookie Auto Decliner installed');

    // Set default settings
    chrome.storage.sync.set({
        enabled: true,
        showNotifications: false,
    });

    // Set initial badge
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'BANNER_DECLINED':
            handleBannerDeclined(message, sender);
            break;

        case 'UPDATE_BADGE':
            updateBadge(sender.tab.id, message.count);
            break;

        default:
            break;
    }

    return true;
});

/**
 * Handle banner declined event
 */
function handleBannerDeclined(message, sender) {

    // Update badge for this tab
    if (sender.tab && sender.tab.id) {
        updateBadge(sender.tab.id, message.count);
    }
}

/**
 * Update badge: show check icon when cookie was declined on this tab
 */
function updateBadge(tabId, count) {
    if (count > 0) {
        chrome.action.setBadgeText({
            tabId: tabId,
            text: '✓'
        });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#7a9b5c' });
    } else {
        chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
        });
    }
}

/**
 * Clear badge when tab is updated or navigated
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
        });
    }
});

/**
 * Handle tab activation - could be used for per-tab stats
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Could load tab-specific data here if needed
});

// Listen for keyboard shortcuts (if defined in manifest)
chrome.commands?.onCommand.addListener((command) => {
    if (command === 'trigger-decline') {
        // Get active tab and send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'MANUAL_TRIGGER'
                });
            }
        });
    }
});