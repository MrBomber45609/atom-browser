// ================================================================
// ATOM SHIELD — Module 9: YouTube Ad Acceleration
// ================================================================
// Optimized: Only activates when ad detected, uses event-driven approach
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

    function getVideo() {
        return document.querySelector('#movie_player video');
    }

    function isAdPlaying() {
        var player = document.querySelector('#movie_player');
        return player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
    }

    function accelerateAd(video) {
        if (!video || state.accelerating) return;

        state.originalMuted = video.muted;
        state.originalVolume = video.volume;
        state.accelerating = true;

        try { video.playbackRate = 16; } catch (e) {
            try { video.playbackRate = 8; } catch (e2) { }
        }
        video.muted = true;
    }

    function restorePlayback() {
        if (!state.accelerating) return;

        var video = getVideo();
        if (video) {
            video.playbackRate = 1;
            video.muted = state.originalMuted;
            video.volume = state.originalVolume;
        }
        state.accelerating = false;
    }

    // Use MutationObserver instead of interval for better performance
    var player = document.querySelector('#movie_player');
    if (player) {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'class') {
                    if (isAdPlaying()) {
                        accelerateAd(getVideo());
                    } else if (state.accelerating) {
                        restorePlayback();
                    }
                }
            }
        });

        observer.observe(player, { attributes: true, attributeFilter: ['class'] });
    }

    // Fallback: also listen for video events
    function attachVideoListener() {
        var video = getVideo();
        if (!video || video._atomAccelAttached) return;
        video._atomAccelAttached = true;

        video.addEventListener('ended', restorePlayback);
        video.addEventListener('ratechange', function () {
            if (!isAdPlaying() && video.playbackRate > 2) {
                video.playbackRate = 1;
            }
        });
    }

    // Watch for player appearing
    AS.observeDOM('#movie_player', function () {
        player = document.querySelector('#movie_player');
        if (player) {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].attributeName === 'class') {
                        if (isAdPlaying()) {
                            accelerateAd(getVideo());
                        } else if (state.accelerating) {
                            restorePlayback();
                        }
                    }
                }
            });
            observer.observe(player, { attributes: true, attributeFilter: ['class'] });
        }
        attachVideoListener();
    });

    // Initial setup
    setTimeout(attachVideoListener, 2000);

})();
