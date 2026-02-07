// ================================================================
// ATOM SHIELD — Module 2: YouTube Cosmetics & Popups
// ================================================================
// Safe visual cleanup for YouTube:
//   - Hide ad slots outside the player (feed, sidebar, promos)
//   - Remove enforcement popups ("turn off your ad blocker")
//   - Resume video if popup paused it
//
// We NEVER touch player internals here — only safe DOM operations.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || !AS.isYT) return;

    // --- CSS: Hide ad elements OUTSIDE the player ---
    // These are safe because YouTube doesn't monitor them
    // for ad blocker detection (only the player area).
    AS.injectCSS(
        // Feed & sidebar ads
        'ytd-ad-slot-renderer,' +
        'ytd-in-feed-ad-layout-renderer,' +
        'ytd-banner-promo-renderer,' +
        'ytd-promoted-sparkles-web-renderer,' +
        'ytd-promoted-video-renderer,' +
        'ytd-display-ad-renderer,' +
        'ytd-compact-promoted-video-renderer,' +
        'ytd-brand-video-singleton-renderer,' +
        '#masthead-ad,' +
        '#merch-shelf,' +
        '#offers-module,' +
        '#donation-shelf,' +
        '#related > ytd-ad-slot-renderer,' +
        'ytd-mealbar-promo-renderer,' +
        'ytd-statement-banner-renderer,' +
        // Shopping & membership promos
        '#ytp-shopping-shelf-button,' +
        'ytd-shopping-engagement-header-renderer,' +
        '.ytp-suggested-action,' +
        '.ytp-shopping-shelf,' +
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],' +
        'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_AD_SLOT"],' +
        // Super Thanks & channel membership
        '#super-thanks-menu-button,' +
        'ytd-membership-upsell-promo-renderer,' +
        'ytd-reel-shelf-renderer:has([aria-label*="Sponsor"]),' +
        // Premium upsell
        'ytd-premium-upsell-dialog-renderer,' +
        'ytd-unlimited-offer-module-renderer,' +
        // Survey prompts
        'ytd-survey-promo-renderer,' +
        'ytd-single-option-survey-renderer' +
        '{display:none!important}'
    );

    // --- Enforcement popup removal ---
    var popupKeywords = [
        'bloqueador', 'ad blocker', 'ad blockers',
        'allow youtube ads', 'permite los anuncios',
        'ad blocking', 'turn off', 'desactiva',
        'incumplen', 'violate'
    ];

    var popupSelectors =
        'ytd-enforcement-message-view-model,' +
        'ytd-ads-enforcement-message-view-model,' +
        '#enforcement-message,' +
        'tp-yt-paper-dialog,' +
        'ytd-mealbar-promo-renderer';

    function removePopups() {
        var found = false;
        try {
            document.querySelectorAll(popupSelectors).forEach(function (el) {
                var txt = (el.textContent || '').toLowerCase();
                for (var i = 0; i < popupKeywords.length; i++) {
                    if (txt.indexOf(popupKeywords[i]) !== -1) {
                        el.remove();
                        found = true;
                        break;
                    }
                }
            });

            // Orphaned backdrops
            document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(function (el) {
                el.remove();
                found = true;
            });
        } catch (e) { }

        if (found) {
            // Resume video if popup paused it
            try {
                var v = document.querySelector('video');
                if (v && v.paused) v.play().catch(AS.noop);
                document.body.style.removeProperty('overflow');
                document.documentElement.style.removeProperty('overflow');
            } catch (e) { }
        }
    }

    // --- Hide sponsored content in feed by text ---
    function hideSponsored() {
        try {
            document.querySelectorAll(
                'ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer'
            ).forEach(function (el) {
                var t = (el.textContent || '').toUpperCase();
                if (t.includes('PATROCINADO') || t.includes('SPONSORED')) {
                    el.style.display = 'none';
                }
            });
        } catch (e) { }
    }

    // --- Intervals ---
    setInterval(removePopups, 2000);
    setInterval(hideSponsored, 3000);

    // --- Observer for instant popup removal ---
    AS.observeDOM(
        'ytd-enforcement-message-view-model,ytd-ads-enforcement-message-view-model,' +
        'tp-yt-paper-dialog,tp-yt-iron-overlay-backdrop',
        function () { setTimeout(removePopups, 100); }
    );

})();