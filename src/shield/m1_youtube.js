// ================================================================
// ATOM SHIELD — Module 1: YouTube Ad Blocker
// ================================================================
// Optimized for performance - uses requestIdleCallback when available
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || !AS.isYT) return;

    // --- Strip ad data from any object ---
    function stripAds(o) {
        if (!o || typeof o !== 'object') return;
        try {
            if (o.adPlacements !== undefined) o.adPlacements = undefined;
            if (o.adSlots !== undefined) o.adSlots = undefined;
            if (o.playerAds !== undefined) o.playerAds = undefined;

            var delKeys = ['adBreakParams', 'adBreakHeartbeatParams', 'adBreakRenderer'];
            for (var j = 0; j < delKeys.length; j++) {
                if (o[delKeys[j]]) delete o[delKeys[j]];
            }

            if (o.auxiliaryUi && o.auxiliaryUi.messageRenderers) {
                if (o.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel) {
                    delete o.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel;
                }
            }

            if (o.playerResponse) stripAds(o.playerResponse);
            if (o.response) stripAds(o.response);

            if (o.playbackTracking) {
                delete o.playbackTracking.ptrackingUrl;
                delete o.playbackTracking.qoeUrl;
                delete o.playbackTracking.atrUrl;
            }
        } catch (e) { }
    }

    // Property traps (one-time setup, no polling needed)
    function trapProperty(obj, prop) {
        try {
            var val = obj[prop];
            if (val && typeof val === 'object') stripAds(val);
            Object.defineProperty(obj, prop, {
                configurable: true, enumerable: true,
                get: function () { return val; },
                set: function (v) {
                    if (v && typeof v === 'object') stripAds(v);
                    val = v;
                }
            });
        } catch (e) { }
    }

    trapProperty(window, 'ytInitialPlayerResponse');
    trapProperty(window, 'ytInitialData');

    // Skip button selectors
    var skipSelectors = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button.ytp-ad-skip-button-container',
        '.ytp-ad-skip-button-slot button'
    ];

    // Try to skip ad - returns true if clicked
    function trySkip() {
        for (var i = 0; i < skipSelectors.length; i++) {
            try {
                var btn = document.querySelector(skipSelectors[i]);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    return true;
                }
            } catch (e) { }
        }
        return false;
    }

    // Check for ads - called on demand
    function checkAd() {
        var player = document.querySelector('#movie_player');
        if (!player) return;

        if (player.classList.contains('ad-showing')) {
            if (!trySkip()) {
                // Try player skipAd method
                try { if (typeof player.skipAd === 'function') player.skipAd(); } catch (e) { }
            }
        }

        // Close overlay ads
        try {
            var close = document.querySelector('.ytp-ad-overlay-close-button');
            if (close) close.click();
        } catch (e) { }
    }

    // Use requestIdleCallback for better performance, fallback to slow interval
    var idleCallback = window.requestIdleCallback || function (cb) { setTimeout(cb, 1000); };

    function scheduleCheck() {
        idleCallback(function () {
            checkAd();
            setTimeout(scheduleCheck, 1500); // Check every 1.5s instead of 0.3s
        }, { timeout: 2000 });
    }

    // Start checking after initial load
    setTimeout(scheduleCheck, 2000);

    // Also check on navigation (more reliable than polling)
    try {
        document.addEventListener('yt-navigate-finish', function () {
            setTimeout(checkAd, 500);
            setTimeout(checkAd, 1500);
        });
    } catch (e) { }

})();