// ================================================================
// ATOM SHIELD — Module 7: Cosmetic Rules (non-YouTube)
// ================================================================
// CSS rules to hide ad containers, iframes, and empty ad slots.
// Also includes dynamic observer for newly inserted ads.
// Only runs on NON-YouTube sites.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || AS.isYT) return;

    // --- Static CSS rules ---
    AS.injectCSS(
        // Google ads
        '[id^="google_ads_"],' +
        '[id^="div-gpt-ad"],' +
        '.adsbygoogle,' +
        'ins.adsbygoogle,' +
        '[data-ad-slot],' +
        '[data-ad-client],' +
        '[data-google-query-id],' +
        // Generic containers
        '[class*="ad-container"],' +
        '[class*="ad-wrapper"],' +
        '[class*="ad-banner"],' +
        '[class*="ad-slot"],' +
        // Taboola / Outbrain
        '[id*="taboola-"],' +
        '[class*="taboola"],' +
        '[id*="outbrain"],' +
        '[class*="OUTBRAIN"],' +
        '.ob-widget,' +
        '.trc_related_container,' +
        // Ad iframes
        'iframe[src*="doubleclick"],' +
        'iframe[src*="googlesyndication"],' +
        'iframe[src*="amazon-adsystem"],' +
        'iframe[id*="google_ads"],' +
        // Structural
        '#ad-wrapper,#ad-container,#ad-header,#ad-footer,' +
        '#ad-sidebar,#sponsored-content,.sponsored-content,' +
        '.advertisement,.ad-placement,.ad-unit,.dfp-ad,' +
        '[aria-label="advertisement"],[aria-label="Advertisement"],' +
        // Overlay
        '.ad-overlay,.ad-interstitial,#interstitial-ad,#overlay-ad' +
        '{display:none!important;height:0!important;max-height:0!important;' +
        'overflow:hidden!important;pointer-events:none!important}'
    );

    // --- Dynamic: hide newly inserted ad elements ---
    AS.observeDOM(
        'ins.adsbygoogle,[id^="div-gpt-ad"],iframe[src*="doubleclick"],' +
        '[class*="taboola"],[class*="outbrain"],[data-ad-slot]',
        function (node) {
            try {
                node.style.display = 'none';
                node.style.height = '0';
            } catch (e) { }
        }
    );

    // --- Collapse empty ad containers periodically ---
    setInterval(function () {
        try {
            document.querySelectorAll('ins.adsbygoogle,[id^="div-gpt-ad"]').forEach(function (el) {
                el.style.display = 'none';
                el.style.height = '0';
                var p = el.parentElement;
                if (p && p.children.length <= 2) {
                    p.style.minHeight = '0';
                    p.style.height = 'auto';
                }
            });
        } catch (e) { }
    }, 4000);

})();