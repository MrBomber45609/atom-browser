// ================================================================
// ATOM SHIELD — Module 4: Ad Network Mocks
// ================================================================
// Mocks for: adsbygoogle, Google IMA SDK, Amazon, Taboola,
// Outbrain, Prebid, MGID, and Google ad variables.
// Only runs on NON-YouTube sites.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || AS.isYT) return;

    var noop = AS.noop;
    var noopArray = AS.noopArray;

    // --- adsbygoogle ---
    window.adsbygoogle = window.adsbygoogle || { loaded: true, push: noop, length: 0 };
    if (!window.adsbygoogle.loaded) {
        window.adsbygoogle.loaded = true;
        window.adsbygoogle.push = noop;
    }

    // --- Google ad variables ---
    window.google_ad_client = 'ca-pub-0000000000000000';
    window.google_ad_status = 1;
    window.__gads = 'ID=0:T=0:RT=0:S=0';
    window.__gpi = 'UID=0:T=0:RT=0:S=0';
    window.google_js_reporting_queue = [];
    window.google_srt = 0;
    window.google_logging_queue = [];
    window.ggeac = noop;

    // --- Google IMA SDK mock (video ads on non-YT sites) ---
    var imaEvt = {
        Type: {
            AD_BREAK_READY: 'adBreakReady', ALL_ADS_COMPLETED: 'allAdsCompleted',
            CLICK: 'click', COMPLETE: 'complete',
            CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
            CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
            FIRST_QUARTILE: 'firstQuartile', IMPRESSION: 'impression',
            LOADED: 'loaded', MIDPOINT: 'midpoint', PAUSED: 'paused',
            RESUMED: 'resumed', STARTED: 'started', THIRD_QUARTILE: 'thirdQuartile',
            SKIPPED: 'skipped', LOG: 'log',
        }
    };

    window.google = window.google || {};
    window.google.ima = {
        AdDisplayContainer: function () { return { initialize: noop, destroy: noop }; },
        AdError: function () { return { getErrorCode: noop, getMessage: function () { return ''; } }; },
        AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
        AdEvent: imaEvt,
        AdsLoader: function () {
            return {
                addEventListener: noop, contentComplete: noop, destroy: noop,
                getSettings: function () {
                    return { setAutoPlayAdBreaks: noop, setLocale: noop, setVpaidMode: noop };
                },
                removeEventListener: noop, requestAds: noop,
            };
        },
        AdsManager: function () {
            return {
                addEventListener: noop, destroy: noop, getCuePoints: noopArray,
                getRemainingTime: function () { return 0; }, getVolume: function () { return 1; },
                init: noop, resize: noop, setVolume: noop, start: noop, stop: noop,
            };
        },
        AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
        AdsRenderingSettings: function () { return {}; },
        AdsRequest: function () { return {}; },
        ImaSdkSettings: function () {
            return {
                setAutoPlayAdBreaks: noop, setLocale: noop, setPlayerType: noop,
                setPlayerVersion: noop, setVpaidAllowed: noop, setVpaidMode: noop,
            };
        },
        settings: { setAutoPlayAdBreaks: noop, setLocale: noop },
        VERSION: '3.0.0',
        ViewMode: { FULLSCREEN: 'fullscreen', NORMAL: 'normal' },
        VpaidMode: { DISABLED: 0, ENABLED: 1, INSECURE: 2 },
    };

    // --- Amazon ---
    window.amznads = { getAds: noop, getTokens: noop, renderAd: noop, setTargeting: noop };
    window.apstag = { _Q: [], fetchBids: noop, init: noop, setDisplayBids: noop, targetingKeys: noopArray };

    // --- Taboola ---
    window._taboola = window._taboola || [];
    window._taboola.push = noop;

    // --- Outbrain ---
    window.OBR = window.OBR || { extern: { video: { get498: noop } } };

    // --- Prebid ---
    window.pbjs = window.pbjs || { que: [] };
    window.pbjs.que.push = function (fn) { try { fn(); } catch (e) { } };

    // --- MGID ---
    window._mgq = [];
    window._mgq.push = noop;

})();