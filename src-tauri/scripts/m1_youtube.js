// ================================================================
// ATOM SHIELD — Module 1: YouTube Ad Blocker
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || !AS.isYT) return;

    // --- Strip ad data from any object ---
    function stripAds(o) {
        if (!o || typeof o !== 'object') return;
        try {
            var arrKeys = ['adPlacements', 'adSlots', 'playerAds'];
            for (var i = 0; i < arrKeys.length; i++) {
                if (Array.isArray(o[arrKeys[i]])) o[arrKeys[i]] = [];
            }
            var delKeys = ['adBreakParams', 'adBreakHeartbeatParams', 'adBreakRenderer'];
            for (var j = 0; j < delKeys.length; j++) {
                if (o[delKeys[j]]) delete o[delKeys[j]];
            }
            if (o.playerResponse) stripAds(o.playerResponse);
            if (o.response) stripAds(o.response);
            if (o.playbackTracking) {
                delete o.playbackTracking.ptrackingUrl;
                delete o.playbackTracking.qoeUrl;
                delete o.playbackTracking.atrUrl;
            }
            if (o.streamingData) {
                delete o.streamingData.serverAbrStreamingUrl;
            }
        } catch (e) { }
    }

    // LAYER 1: defineProperty traps
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

    // LAYER 2: Player API polling
    function pollPlayer() {
        try {
            var player = document.querySelector('#movie_player');
            if (!player) return;
            if (typeof player.getPlayerResponse === 'function') {
                var resp = player.getPlayerResponse();
                if (resp) stripAds(resp);
            }
            if (typeof player.getVideoData === 'function') {
                var vd = player.getVideoData();
                if (vd && vd.isAd) {
                    if (typeof player.skipAd === 'function') player.skipAd();
                }
            }
        } catch (e) { }
    }

    setInterval(pollPlayer, 1500);
    try {
        document.addEventListener('yt-navigate-finish', function () {
            setTimeout(pollPlayer, 500);
            setTimeout(pollPlayer, 1500);
        });
    } catch (e) { }

    // LAYER 3: Auto-click skip button
    setInterval(function () {
        try {
            var p = document.querySelector('#movie_player');
            if (!p || !p.classList.contains('ad-showing')) return;
            var sels = [
                '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
                '.ytp-skip-ad-button', 'button.ytp-ad-skip-button-container'
            ];
            for (var i = 0; i < sels.length; i++) {
                var btn = p.querySelector(sels[i]);
                if (btn) { btn.click(); return; }
            }
            var close = p.querySelector('.ytp-ad-overlay-close-button');
            if (close) close.click();
        } catch (e) { }
    }, 500);

})();