!(function () {
    let script = document.currentScript;
    if (!script) {
        script = document.querySelector('script[data-site][src*="/lt"]');
    }
    if (!script) return;

    const siteId = script.getAttribute('data-site');
    if (!siteId) return;

    const endpoint = 'https://t.lynxmetrics.com/api/v1/event';
    const adminKey = 'lynx_admin_' + siteId.slice(-6);
    const adminToken = localStorage.getItem(adminKey) || null;

    let currentPageId = Math.random().toString(36).substring(2, 15);
    let lastUrl = window.location.pathname + window.location.search;

    const getSessionId = () => {
        let sid = localStorage.getItem('lynx_session_id');
        let stime = localStorage.getItem('lynx_session_time');
        const now = Date.now();
        if (!sid || !stime || (now - parseInt(stime, 10)) > 30 * 60 * 1000) {
            sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('lynx_session_id', sid);
        }
        localStorage.setItem('lynx_session_time', now.toString());
        return sid;
    };

    const sendPayload = (payload) => {
        const dataObj = { pageId: currentPageId, sessionId: getSessionId(), ...payload };
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
                pageId: currentPageId,
                sessionId: getSessionId()
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

    const stopTimers = () => {
        if (initialTimer) {
            clearTimeout(initialTimer);
            initialTimer = null;
        }
        if (periodicTimer) {
            clearInterval(periodicTimer);
            periodicTimer = null;
        }
    };

    const startTimers = () => {
        stopTimers();
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
            stopTimers();
        } else {
            sessionStartTime = performance.now();
            startTimers();
        }
    });

    const trackPageview = () => {
        lastUrl = window.location.pathname + window.location.search;
        sendPayload({
            type: 'pageview',
            site: siteId.toLowerCase(),
            url: lastUrl,
            referrer: document.referrer || null,
            screen: window.screen.width + 'x' + window.screen.height
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

    const isInteractive = (node) => {
        if (!node) return false;
        const tagName = node.tagName.toLowerCase();
        if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) return true;
        if (node.getAttribute('role') === 'button') return true;
        return false;
    };

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
            if (idNode && idNode.id && isInteractive(idNode)) {
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
