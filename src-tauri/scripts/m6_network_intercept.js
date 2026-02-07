// ================================================================
// ATOM SHIELD — Module 6: Network Intercept (non-YouTube)
// ================================================================
// Intercept fetch/XHR/sendBeacon to block tracking requests
// that bypass the network blocker (inline scripts).
// Only runs on NON-YouTube sites.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || AS.isYT) return;

    var trackingRx = [
        /\/pagead\//i, /\/adserver/i, /\/tracker\./i, /\/pixel\./i,
        /\/beacon\./i, /\/collect\?/i, /google-analytics\.com/i,
        /googletagmanager\.com/i, /doubleclick\.net/i,
        /googlesyndication\.com/i, /facebook\.net.*fbevents/i,
        /hotjar\.com/i, /mixpanel\.com/i, /segment\.(com|io)/i,
        /amplitude\.com/i, /clarity\.ms/i, /criteo\.(com|net)/i,
        /taboola\.com/i, /outbrain\.com/i, /adnxs\.com/i,
        /moatads\.com/i, /imasdk\.googleapis\.com/i,
    ];

    function isTracking(url) {
        if (!url || typeof url !== 'string') return false;
        for (var i = 0; i < trackingRx.length; i++) {
            if (trackingRx[i].test(url)) return true;
        }
        return false;
    }

    // --- Fetch ---
    var _fetch = window.fetch;
    window.fetch = function (input) {
        var url = typeof input === 'string' ? input :
                  (input && input.url) ? input.url : '';
        if (isTracking(url)) {
            return Promise.resolve(new Response('', {
                status: 200, headers: { 'Content-Type': 'text/plain' }
            }));
        }
        return _fetch.apply(this, arguments);
    };
    AS.hideFunction(window.fetch, 'fetch');

    // --- XHR ---
    var _xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, url) {
        if (isTracking(url)) {
            this._atomBlocked = true;
            return _xhrOpen.call(this, m, 'data:text/plain,');
        }
        this._atomBlocked = false;
        return _xhrOpen.apply(this, arguments);
    };
    AS.hideFunction(XMLHttpRequest.prototype.open, 'open');

    // --- sendBeacon ---
    var _beacon = navigator.sendBeacon;
    if (_beacon) {
        navigator.sendBeacon = function (url) {
            if (isTracking(url)) return true;
            return _beacon.apply(navigator, arguments);
        };
        AS.hideFunction(navigator.sendBeacon, 'sendBeacon');
    }

})();