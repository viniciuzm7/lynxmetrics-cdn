(function() {
    const script = document.currentScript;
    if (!script) return;

    const site = script.getAttribute('data-site');
    if (!site) return;

    const scriptUrl = new URL(script.src);
    const apiBase = scriptUrl.origin;

    const adminKey = `_lx_${site.slice(-6)}`;
    const adminVal = localStorage.getItem(adminKey) || null;

    fetch(`${apiBase}/api/v1/track/pageview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
            site: site.toLowerCase(),
            url: window.location.pathname + window.location.search,
            referrer: document.referrer || null,
            admin: adminVal
        })
    }).catch(err => console.warn('[LynxMetrics] Error:', err.message));

    document.addEventListener('click', function(e) {
        const target = e.target.closest('[id]');
        if (target && target.id) {
            fetch(`${apiBase}/api/v1/track/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({
                    site: site.toLowerCase(),
                    event_name: 'click',
                    element_id: target.id,
                    url: window.location.pathname + window.location.search,
                    admin: adminVal
                })
            }).catch(err => console.warn('[LynxMetrics] Error:', err.message));
        }
    }, true);
})();
