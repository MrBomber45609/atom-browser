// ================================================================
// ATOM SHIELD — Pre-DOM Injection Script
// ================================================================
// Runs BEFORE page scripts via preload. Two mechanisms:
//   1. Property traps on ytInitialPlayerResponse/ytInitialData
//   2. Fetch/XHR interception to strip ads from API responses
// ================================================================

const { webFrame } = require('electron');

// ====== UNIVERSAL: Patch JS environment to hide Electron ======
// Google sign-in checks navigator.userAgentData + window.chrome via JS
const CHROME_PATCH = `
(function() {
    'use strict';
    if (window.__atomChromePatch) return;
    window.__atomChromePatch = true;

    // 1. Patch navigator.userAgentData (Chrome Client Hints JS API)
    try {
        var brands = [
            { brand: 'Chromium', version: '120' },
            { brand: 'Not:A-Brand', version: '8' },
            { brand: 'Google Chrome', version: '120' }
        ];
        Object.defineProperty(navigator, 'userAgentData', {
            value: Object.freeze({
                brands: brands,
                mobile: false,
                platform: 'Windows',
                getHighEntropyValues: function(hints) {
                    return Promise.resolve({
                        architecture: 'x86',
                        bitness: '64',
                        model: '',
                        platform: 'Windows',
                        platformVersion: '10.0.0',
                        uaFullVersion: '120.0.0.0',
                        fullVersionList: [
                            { brand: 'Chromium', version: '120.0.0.0' },
                            { brand: 'Not:A-Brand', version: '8.0.0.0' },
                            { brand: 'Google Chrome', version: '120.0.0.0' }
                        ],
                        wow64: false
                    });
                },
                toJSON: function() {
                    return { brands: brands, mobile: false, platform: 'Windows' };
                }
            }),
            configurable: true
        });
    } catch(e) {}

    // 2. Ensure window.chrome looks like real Chrome
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) {
        window.chrome.runtime = {
            connect: function() { return { onMessage: { addListener: function(){} }, postMessage: function(){} }; },
            sendMessage: function() {},
            onMessage: { addListener: function(){} },
            id: undefined
        };
    }
    if (!window.chrome.csi) window.chrome.csi = function() { return {}; };
    if (!window.chrome.loadTimes) window.chrome.loadTimes = function() { return {}; };

    // 3. Clean navigator.userAgent string from Electron references
    try {
        var cleanUA = navigator.userAgent
            .replace(/\\sElectron\\/[\\d.]+/g, '')
            .replace(/\\satom-browser\\/[\\d.]+/g, '');
        if (cleanUA !== navigator.userAgent) {
            Object.defineProperty(navigator, 'userAgent', {
                get: function() { return cleanUA; },
                configurable: true
            });
        }
    } catch(e) {}

    // 4. Hide navigator.webdriver (automation detection)
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: function() { return false; },
            configurable: true
        });
    } catch(e) {}
})();
`;

try {
    webFrame.executeJavaScript(CHROME_PATCH, true).catch(() => {});
} catch (e) {}

// ====== YOUTUBE-SPECIFIC: Ad data stripping ======
const INJECTION_SCRIPT = `
(function() {
    'use strict';

    if (window.__atomShieldPreload) return;
    window.__atomShieldPreload = true;

    var host = window.location.hostname || '';
    if (!host.includes('youtube.com') && !host.includes('youtu.be')) return;

    // ====== AD DATA STRIPPING ======
    var adKeys = [
        'adPlacements', 'adSlots', 'playerAds', 'adBreakParams',
        'adBreakHeartbeatParams', 'adBreakRenderer'
    ];

    function stripAds(obj, depth) {
        if (!obj || typeof obj !== 'object' || depth > 10) return obj;
        try {
            for (var i = 0; i < adKeys.length; i++) {
                var k = adKeys[i];
                if (obj[k] !== undefined) {
                    if (Array.isArray(obj[k])) obj[k] = [];
                    else delete obj[k];
                }
            }

            // Remove enforcement messages (anti-adblock popups)
            if (obj.auxiliaryUi && obj.auxiliaryUi.messageRenderers) {
                var mr = obj.auxiliaryUi.messageRenderers;
                if (mr.bkaEnforcementMessageViewModel) delete mr.bkaEnforcementMessageViewModel;
                if (mr.enforcementMessageViewModel) delete mr.enforcementMessageViewModel;
            }

            // Remove tracking URLs
            if (obj.playbackTracking) {
                delete obj.playbackTracking.ptrackingUrl;
                delete obj.playbackTracking.qoeUrl;
                delete obj.playbackTracking.atrUrl;
            }

            // Recurse into nested structures
            if (obj.playerResponse) stripAds(obj.playerResponse, depth + 1);
            if (obj.response) stripAds(obj.response, depth + 1);
            if (obj.onResponseReceivedActions) {
                for (var j = 0; j < obj.onResponseReceivedActions.length; j++) {
                    stripAds(obj.onResponseReceivedActions[j], depth + 1);
                }
            }
        } catch (e) {}
        return obj;
    }

    // ====== PROPERTY TRAPS ======
    function createTrap(propName) {
        var value = window[propName];
        if (value && typeof value === 'object') stripAds(value, 0);

        try {
            Object.defineProperty(window, propName, {
                configurable: true, enumerable: true,
                get: function() { return value; },
                set: function(v) {
                    if (v && typeof v === 'object') stripAds(v, 0);
                    value = v;
                }
            });
        } catch(e) {}
    }

    createTrap('ytInitialPlayerResponse');
    createTrap('ytInitialData');

    // ====== FETCH INTERCEPTION ======
    // YouTube SPA uses fetch for /youtubei/v1/player and /youtubei/v1/next
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';

        var isPlayerApi = url.includes('/youtubei/v1/player') ||
                          url.includes('/youtubei/v1/next') ||
                          url.includes('/youtubei/v1/browse');

        if (!isPlayerApi) return _fetch.apply(this, arguments);

        return _fetch.apply(this, arguments).then(function(response) {
            if (!response.ok) return response;

            return response.clone().text().then(function(text) {
                try {
                    var data = JSON.parse(text);
                    stripAds(data, 0);
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } catch(e) {
                    return response;
                }
            });
        });
    };

    // Hide patched fetch
    try {
        Object.defineProperty(window.fetch, 'toString', {
            value: function() { return 'function fetch() { [native code] }'; }
        });
    } catch(e) {}

    // ====== XHR INTERCEPTION ======
    var _xhrOpen = XMLHttpRequest.prototype.open;
    var _xhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._atomUrl = url || '';
        return _xhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        var self = this;
        var url = self._atomUrl || '';

        var isPlayerApi = url.includes('/youtubei/v1/player') ||
                          url.includes('/youtubei/v1/next') ||
                          url.includes('/youtubei/v1/browse');

        if (isPlayerApi) {
            self.addEventListener('readystatechange', function() {
                if (self.readyState === 4 && self.status === 200) {
                    try {
                        var data = JSON.parse(self.responseText);
                        stripAds(data, 0);
                        var clean = JSON.stringify(data);
                        Object.defineProperty(self, 'responseText', {
                            value: clean, writable: false
                        });
                        Object.defineProperty(self, 'response', {
                            value: clean, writable: false
                        });
                    } catch(e) {}
                }
            });
        }

        return _xhrSend.apply(this, arguments);
    };

    console.log('[Atom Shield] Pre-DOM traps + fetch/XHR interception active');
})();
`;

try {
    webFrame.executeJavaScript(INJECTION_SCRIPT, true).catch(() => {});
} catch (e) {}
