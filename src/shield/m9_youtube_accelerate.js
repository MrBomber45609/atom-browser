// ================================================================
// ATOM SHIELD — Module 9: YouTube Ad Acceleration
// ================================================================
// Fallback: if an ad can't be skipped, accelerate it to 16x speed
// and mute it. Shares observer pattern with m1.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || !AS.isYT) return;

    var state = {
        accelerating: false,
        originalMuted: false,
        originalVolume: 1
    };

    function isAdPlaying() {
        var player = document.querySelector('#movie_player');
        return player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
    }

    function accelerateAd() {
        var video = document.querySelector('#movie_player video');
        if (!video || state.accelerating) return;

        state.originalMuted = video.muted;
        state.originalVolume = video.volume;
        state.accelerating = true;

        video.muted = true;
        try { video.playbackRate = 16; } catch (e) {
            try { video.playbackRate = 8; } catch (e2) {
                try { video.playbackRate = 4; } catch (e3) { }
            }
        }
    }

    function restorePlayback() {
        if (!state.accelerating) return;
        state.accelerating = false;

        var video = document.querySelector('#movie_player video');
        if (video) {
            video.playbackRate = 1;
            video.muted = state.originalMuted;
            video.volume = state.originalVolume;
        }
    }

    function onPlayerClassChange() {
        if (isAdPlaying()) {
            accelerateAd();
        } else if (state.accelerating) {
            restorePlayback();
        }
    }

    function observePlayer(player) {
        if (player._atomAccelObserved) return;
        player._atomAccelObserved = true;

        var obs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'class') {
                    onPlayerClassChange();
                    return;
                }
            }
        });
        obs.observe(player, { attributes: true, attributeFilter: ['class'] });

        // Attach video event listeners
        var video = player.querySelector('video');
        if (video && !video._atomAccelAttached) {
            video._atomAccelAttached = true;
            video.addEventListener('ended', restorePlayback);
            video.addEventListener('ratechange', function () {
                if (!isAdPlaying() && video.playbackRate > 2) {
                    video.playbackRate = 1;
                }
            });
        }

        onPlayerClassChange();
    }

    // Find player now or wait for it
    var player = document.querySelector('#movie_player');
    if (player) {
        observePlayer(player);
    } else {
        AS.observeDOM('#movie_player', function () {
            var p = document.querySelector('#movie_player');
            if (p) observePlayer(p);
        });
    }

    // SPA navigation
    try {
        document.addEventListener('yt-navigate-finish', function () {
            setTimeout(function () {
                var p = document.querySelector('#movie_player');
                if (p) observePlayer(p);
            }, 500);
        });
    } catch (e) { }

})();
