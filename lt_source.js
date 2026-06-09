!(function () {
    const script = document.currentScript;
    if (!script) return;

    const siteId = script.getAttribute('data-site');
    if (!siteId) return;

    const endpoint = 'https://t.lynxmetrics.com/api/v1/event';
    const adminKey = siteId.slice(-6);
    const adminToken = localStorage.getItem(adminKey) || null;

    let currentPageId = Math.random().toString(36).substring(2, 15);
    let lastUrl = window.location.pathname + window.location.search;

    const sendPayload = (payload) => {
        const dataObj = { pageId: currentPageId, ...payload };
        if (adminToken) {
            dataObj.adminToken = adminToken;
        }
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            mode: 'cors',
            body: JSON.stringify(dataObj)
        }).catch(() => {});
    };

    let sessionStartTime = performance.now();
    let initialTimer = null;
    let periodicTimer = null;

    const sendDuration = () => {
        const now = performance.now();
        const durationSecs = (now - sessionStartTime) / 1000;
        if (durationSecs >= 0.2) {
            const dataObj = {
                type: 'duration',
                site: siteId.toLowerCase(),
                duration: Number(durationSecs.toFixed(3)),
                url: lastUrl,
                pageId: currentPageId
            };
            if (adminToken) {
                dataObj.adminToken = adminToken;
            }
            const data = JSON.stringify(dataObj);

            if (navigator.sendBeacon) {
                const blob = new Blob([data], { type: 'text/plain' });
                navigator.sendBeacon(endpoint, blob);
            } else {
                fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    mode: 'cors',
                    keepalive: true,
                    body: data
                }).catch(() => {});
            }
            sessionStartTime = now;
        }
    };

    const startTimers = () => {
        if (initialTimer) clearTimeout(initialTimer);
        if (periodicTimer) clearInterval(periodicTimer);
        sessionStartTime = performance.now();
        initialTimer = setTimeout(() => {
            if (document.visibilityState === 'visible') {
                sendDuration();
            }
            periodicTimer = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    sendDuration();
                }
            }, 15000);
        }, 1000);
    };

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            sendDuration();
        } else {
            sessionStartTime = performance.now();
        }
    });

    const trackPageview = () => {
        lastUrl = window.location.pathname + window.location.search;
        sendPayload({
            type: 'pageview',
            site: siteId.toLowerCase(),
            url: lastUrl,
            referrer: document.referrer || null
        });
    };

    if (document.visibilityState === 'visible') {
        trackPageview();
        startTimers();
    } else {
        const onVisible = function () {
            if (document.visibilityState === 'visible') {
                trackPageview();
                startTimers();
                document.removeEventListener('visibilitychange', onVisible);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
    }

    document.addEventListener('click', (e) => {
        const lynxNode = e.target.closest('[data-lynx-event]');
        if (lynxNode) {
            const eventName = lynxNode.getAttribute('data-lynx-event');
            if (eventName) {
                sendPayload({
                    type: 'event',
                    site: siteId.toLowerCase(),
                    eventName,
                    url: lastUrl
                });
            }
        } else {
            const idNode = e.target.closest('[id]');
            if (idNode && idNode.id) {
                sendPayload({
                    type: 'event',
                    site: siteId.toLowerCase(),
                    eventName: 'click',
                    elementId: idNode.id,
                    url: lastUrl
                });
            }
        }
    }, true);

    const handleSPA = () => {
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl !== lastUrl) {
            sendDuration();
            currentPageId = Math.random().toString(36).substring(2, 15);
            trackPageview();
            startTimers();
        }
    };

    const originalPushState = history.pushState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        handleSPA();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        handleSPA();
    };

    window.addEventListener('popstate', handleSPA);

})();
