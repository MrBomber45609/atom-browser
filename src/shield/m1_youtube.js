// ================================================================
// ATOM SHIELD — Module 1: YouTube Ad Blocker
// ================================================================
// MutationObserver-based (instant reaction instead of polling).
// The preload already strips ad data from API responses.
// This module handles ads that slip through: skip, close, mute.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || !AS.isYT) return;

    // Skip button selectors (YouTube updates these periodically)
    var skipSelectors = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button.ytp-ad-skip-button-container',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-skip-button-modern.ytp-button'
    ];

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

    function closeOverlayAd() {
        try {
            var close = document.querySelector('.ytp-ad-overlay-close-button');
            if (close) close.click();
        } catch (e) { }
    }

    function handleAd() {
        var player = document.querySelector('#movie_player');
        if (!player) return;

        if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
            // Try skip immediately
            if (!trySkip()) {
                // Try API skipAd
                try { if (typeof player.skipAd === 'function') player.skipAd(); } catch (e) { }

                // Fast-forward: set currentTime to duration to end ad instantly
                var video = player.querySelector('video');
                if (video && video.duration && isFinite(video.duration)) {
                    video.currentTime = video.duration;
                }
            }
            // Retry skip after brief delay (skip button appears after a few ms)
            setTimeout(trySkip, 300);
            setTimeout(trySkip, 800);
        }

        closeOverlayAd();
    }

    // ====== INSTANT DETECTION via MutationObserver ======
    // Watch for class changes on #movie_player (ad-showing gets added/removed)
    function observePlayer(player) {
        if (player._atomObserved) return;
        player._atomObserved = true;

        var obs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'class') {
                    handleAd();
                    return;
                }
            }
        });
        obs.observe(player, { attributes: true, attributeFilter: ['class'] });

        // Check current state immediately
        handleAd();
    }

    // Try to find player now
    var player = document.querySelector('#movie_player');
    if (player) {
        observePlayer(player);
    }

    // If player doesn't exist yet, watch for it to appear
    var bodyObs = new MutationObserver(function () {
        var p = document.querySelector('#movie_player');
        if (p) {
            observePlayer(p);
            bodyObs.disconnect();
        }
    });

    if (document.documentElement) {
        bodyObs.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Also react to SPA navigation
    try {
        document.addEventListener('yt-navigate-finish', function () {
            setTimeout(function () {
                var p = document.querySelector('#movie_player');
                if (p) observePlayer(p);
                handleAd();
            }, 300);
        });
    } catch (e) { }

})();
