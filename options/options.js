// Options page script

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const enableExtension = document.getElementById('enableExtension');
    const showNotifications = document.getElementById('showNotifications');
    const totalDeclined = document.getElementById('totalDeclined');
    const resetStats = document.getElementById('resetStats');
    const saveStatus = document.getElementById('saveStatus');

    // Load initial settings
    await loadSettings();

    // Set up event listeners
    setupEventListeners();

    /**
     * Load all settings from storage
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                'enabled',
                'showNotifications',
                'totalDeclined'
            ]);

            // Load toggle states
            if (enableExtension) enableExtension.checked = result.enabled !== false;
            if (showNotifications) showNotifications.checked = result.showNotifications || false;

            // Load statistics
            if (totalDeclined) totalDeclined.textContent = result.totalDeclined ?? 0;
        } catch (error) {
            console.error('Failed to load settings:', error);
            if (saveStatus) showStatus('Failed to load settings', 'error');
        }
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Enable extension toggle
        enableExtension.addEventListener('change', async (e) => {
            await saveSetting('enabled', e.target.checked);
            showStatus('Settings saved', 'success');
        });

        // Show notifications toggle
        showNotifications.addEventListener('change', async (e) => {
            await saveSetting('showNotifications', e.target.checked);
            showStatus('Settings saved', 'success');
        });


        // Reset statistics
        resetStats.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all statistics?')) {
                await chrome.storage.sync.set({ totalDeclined: 0 });
                if (totalDeclined) totalDeclined.textContent = '0';
                showStatus('Statistics reset', 'success');
            }
        });
    }

    /**
     * Save a setting to storage
     */
    async function saveSetting(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
            throw error;
        }
    }


    /**
     * Validate domain format
     */
    function isValidDomain(domain) {
        // Basic domain validation
        const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
        return domainPattern.test(domain);
    }

    /**
     * Show status message
     */
    function showStatus(message, type = 'success') {
        if (!saveStatus) return;
        saveStatus.textContent = message;
        saveStatus.className = `save-status show ${type}`;

        setTimeout(() => {
            if (saveStatus) saveStatus.classList.remove('show');
        }, 3000);
    }
});