// ================================================================
// ATOM SHIELD — Module 5: Anti-Anti-Adblock
// ================================================================
// Neutralize ad blocker detection scripts:
//   - FuckAdBlock / BlockAdBlock mocks
//   - Detection flag variables
//   - Bait elements (Trusted Types safe — no innerHTML)
// Only runs on NON-YouTube sites.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || AS.isYT) return;

    // --- FuckAdBlock / BlockAdBlock ---
    var fabMock = {
        on: function (type, fn) {
            if (type === 'notDetected' || type === 'adNotDetected') {
                try { fn(); } catch (e) { }
            }
            return this;
        },
        onDetected: function () { return this; },
        onNotDetected: function (fn) { try { fn(); } catch (e) { } return this; },
        check: AS.noop,
        emitEvent: AS.noop,
        clearEvent: AS.noop,
        setOption: function () { return this; },
    };

    window.fuckAdBlock = fabMock;
    window.blockAdBlock = fabMock;
    window.sniffAdBlock = fabMock;
    window.FuckAdBlock = function () { return fabMock; };
    window.BlockAdBlock = function () { return fabMock; };

    // --- Detection flags ---
    window.adBlockEnabled = false;
    window.adBlockDetected = false;
    window.adsBlocked = false;
    window.canRunAds = true;
    window.isAdBlockActive = false;
    window.__ads_blocked = false;
    window.adBlockDisabled = true;

    // --- Bait elements ---
    // Ad blocker detectors create elements with ad-like class names
    // and check if they're hidden. We create them so they exist.
    // IMPORTANT: Uses textContent, NOT innerHTML (Trusted Types safe).
    function createBaits() {
        var classes = [
            'ad_banner', 'ad-banner', 'ad_wrapper', 'adsbox',
            'ad-placeholder', 'ad-unit', 'ad-slot', 'banner_ad',
            'pub_300x250', 'pub_728x90', 'textad', 'sponsoredAd'
        ];
        var target = document.body;
        if (!target) return;

        for (var i = 0; i < classes.length; i++) {
            try {
                var d = document.createElement('div');
                d.className = classes[i];
                d.setAttribute('id', classes[i]);
                d.style.cssText =
                    'position:absolute!important;left:-9999px!important;' +
                    'top:-9999px!important;width:1px!important;height:1px!important;' +
                    'opacity:0.01!important;pointer-events:none!important;';
                d.textContent = ' ';
                target.appendChild(d);
            } catch (e) { }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBaits);
    } else {
        createBaits();
    }

})();