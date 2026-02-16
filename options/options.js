// Options page script

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const enableExtension = document.getElementById('enableExtension');
    const showNotifications = document.getElementById('showNotifications');
    const whitelistInput = document.getElementById('whitelistInput');
    const addWhitelist = document.getElementById('addWhitelist');
    const whitelistList = document.getElementById('whitelistList');
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
                'whitelistedDomains',
                'totalDeclined'
            ]);

            // Load toggle states
            enableExtension.checked = result.enabled !== false;
            showNotifications.checked = result.showNotifications || false;

            // Load whitelist
            const domains = result.whitelistedDomains || [];
            renderWhitelist(domains);

            // Load statistics
            totalDeclined.textContent = result.totalDeclined || 0;
        } catch (error) {
            console.error('Failed to load settings:', error);
            showStatus('Failed to load settings', 'error');
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

        // Add whitelist domain
        addWhitelist.addEventListener('click', addDomainToWhitelist);
        whitelistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addDomainToWhitelist();
            }
        });

        // Reset statistics
        resetStats.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all statistics?')) {
                await chrome.storage.sync.set({ totalDeclined: 0 });
                totalDeclined.textContent = '0';
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
     * Add domain to whitelist
     */
    async function addDomainToWhitelist() {
        const domain = whitelistInput.value.trim().toLowerCase();

        if (!domain) {
            showStatus('Please enter a domain', 'error');
            return;
        }

        // Basic validation
        if (!isValidDomain(domain)) {
            showStatus('Please enter a valid domain (e.g., example.com)', 'error');
            return;
        }

        try {
            const result = await chrome.storage.sync.get(['whitelistedDomains']);
            const domains = result.whitelistedDomains || [];

            // Check if domain already exists
            if (domains.includes(domain)) {
                showStatus('Domain already in whitelist', 'error');
                return;
            }

            // Add domain
            domains.push(domain);
            await chrome.storage.sync.set({ whitelistedDomains: domains });

            // Update UI
            renderWhitelist(domains);
            whitelistInput.value = '';
            showStatus('Domain added to whitelist', 'success');
        } catch (error) {
            console.error('Failed to add domain:', error);
            showStatus('Failed to add domain', 'error');
        }
    }

    /**
     * Remove domain from whitelist
     */
    async function removeDomainFromWhitelist(domain) {
        try {
            const result = await chrome.storage.sync.get(['whitelistedDomains']);
            const domains = result.whitelistedDomains || [];

            // Remove domain
            const updatedDomains = domains.filter(d => d !== domain);
            await chrome.storage.sync.set({ whitelistedDomains: updatedDomains });

            // Update UI
            renderWhitelist(updatedDomains);
            showStatus('Domain removed from whitelist', 'success');
        } catch (error) {
            console.error('Failed to remove domain:', error);
            showStatus('Failed to remove domain', 'error');
        }
    }

    /**
     * Render whitelist domains
     */
    function renderWhitelist(domains) {
        whitelistList.innerHTML = '';

        domains.forEach(domain => {
            const li = document.createElement('li');
            li.className = 'domain-item';

            const span = document.createElement('span');
            span.className = 'domain-name';
            span.textContent = domain;

            const button = document.createElement('button');
            button.className = 'remove-btn';
            button.textContent = 'Remove';
            button.addEventListener('click', () => removeDomainFromWhitelist(domain));

            li.appendChild(span);
            li.appendChild(button);
            whitelistList.appendChild(li);
        });
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
        saveStatus.textContent = message;
        saveStatus.className = `save-status show ${type}`;

        setTimeout(() => {
            saveStatus.classList.remove('show');
        }, 3000);
    }
});