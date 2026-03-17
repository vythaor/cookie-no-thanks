// Popup: show "Cookie declined successfully" only when it happened; otherwise show nothing.

document.addEventListener('DOMContentLoaded', async () => {
    const enableToggle = document.getElementById('enableToggle');
    const openOptions = document.getElementById('openOptions');

    await loadSettings();
    await updateStatus();

    if (enableToggle) {
        enableToggle.addEventListener('change', async (e) => {
            const enabled = !!e.target.checked;
            await chrome.storage.sync.set({ enabled });
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled }).catch(() => {}));
        });
    }

    if (openOptions) {
        openOptions.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });
    }

    chrome.runtime.onMessage.addListener((msg, sender) => {
        if (msg.type === 'BANNER_DECLINED' && sender.tab?.id) {
            chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
                if (activeTab?.id === sender.tab.id) showSuccess();
            });
        }
    });

    async function loadSettings() {
        try {
            const r = await chrome.storage.sync.get(['enabled']);
            if (enableToggle) enableToggle.checked = r.enabled !== false;
        } catch (e) {}
    }

    function showSuccess() {
        const el = document.getElementById('statusMessage');
        if (!el) return;
        el.textContent = 'Cookie declined successfully';
        el.hidden = false;
    }

    function hideStatus() {
        const el = document.getElementById('statusMessage');
        if (el) el.hidden = true;
    }

    async function updateStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                hideStatus();
                return;
            }
            chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, (response) => {
                const el = document.getElementById('statusMessage');
                if (!el) return;
                if (chrome.runtime.lastError || !response) {
                    el.hidden = true;
                    return;
                }
                if ((response.processed || 0) > 0) {
                    el.textContent = 'Cookie declined successfully';
                    el.hidden = false;
                } else {
                    el.hidden = true;
                }
            });
        } catch (e) {
            hideStatus();
        }
    }

});
