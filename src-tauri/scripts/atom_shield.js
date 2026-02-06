(function () {
    'use strict';

    var isYT = window.location.hostname.includes('youtube.com');

    // ================================================================
    // 1. DOMAIN THREATS
    // ================================================================
    var DOMAIN_THREATS = [
        // Ads - Google
        "doubleclick.net", "googlesyndication.com", "googleadservices.com",
        "googletagmanager.com", "google-analytics.com", "pagead2.googlesyndication",
        "adservice.google", "googletagservices.com", "partner.googleadservices",
        "tpc.googlesyndication",
        // Ads - Amazon
        "amazon-adsystem.com", "aax.amazon",
        // Ads - Facebook
        "facebook.net/en_US/fbevents", "connect.facebook.net",
        // Ads - Networks
        "advmaker", "adroll.com", "taboola.com", "outbrain.com",
        "popads.net", "popcash.net", "mgid.com", "adblade.com",
        "adnxs.com", "adsrvr.org", "ad-delivery", "adform.net",
        "bidswitch.net", "casalemedia.com", "contextweb.com",
        "criteo.com", "criteo.net", "dotomi.com", "eyereturn.com",
        "fastclick.net", "flashtalking.com", "freewheel.tv",
        "gumgum.com", "indexww.com",
        "lijit.com", "mathtag.com", "media.net", "mediamath.com",
        "moatads.com", "mookie1.com", "nativo.com",
        "openx.net", "pubmatic.com", "pulsepoint.com",
        "rfihub.com", "richrelevance.com", "rubiconproject.com",
        "scorecardresearch.com", "sharethrough.com",
        "simpli.fi", "smaato.net", "smartadserver.com",
        "sonobi.com", "spotxchange.com", "steelhousemedia.com",
        "stickyadstv.com", "teads.tv", "tidaltv.com",
        "trafficjunky.com", "tribalfusion.com", "turn.com",
        "undertone.com", "yieldmo.com", "yieldoptimizer.com",
        "zemanta.com", "zergnet.com",
        "2mdn.net", "serving-sys.com", "innovid.com",
        "aniview.com", "springserve.com", "connatix.com",
        "adsafeprotected.com",
        // Analytics
        "hotjar.com", "static.hotjar.com", "script.hotjar.com",
        "mixpanel.com", "cdn.mxpnl.com",
        "segment.com", "cdn.segment.com", "api.segment.io",
        "amplitude.com", "cdn.amplitude.com",
        "heapanalytics.com", "heap.io",
        "fullstory.com", "rs.fullstory.com",
        "mouseflow.com",
        "crazyegg.com", "script.crazyegg.com",
        "optimizely.com", "cdn.optimizely.com",
        "quantserve.com", "pixel.quantserve.com",
        "chartbeat.com", "static.chartbeat.com",
        "parsely.com", "cdn.parsely.com",
        "matomo.cloud", "piwik.pro",
        "kissmetrics.com",
        "clarity.ms",
        "newrelic.com", "js-agent.newrelic.com", "bam.nr-data.net",
        "stats.wp.com",
        "mc.yandex.ru", "yandex.ru/metrika",
        "top-fwz1.mail.ru",
        "statcounter.com",
        "clicky.com", "static.getclicky.com",
        "woopra.com", "gauges.com", "histats.com",
        "counter.yadro.ru", "liveinternet.ru", "tns-counter.ru",
        "omtrdc.net", "demdex.net", "everesttech.net",
        "2o7.net", "omniture.com",
        "bluekai.com", "exelator.com", "krxd.net",
        // Error monitoring
        "sentry.io", "browser.sentry-cdn.com", "sentry-cdn.com",
        "js.sentry-cdn.com",
        "bugsnag.com", "d2wy8f7a9ursnm.cloudfront.net",
        "raygun.com", "raygun.io", "rollbar.com",
        "logrocket.com", "cdn.logrocket.io", "cdn.lr-ingest.io",
        "trackjs.com", "errorception.com",
        "airbrake.io", "honeybadger.io", "atatus.com",
        // Social trackers
        "pixel.facebook.com", "www.facebook.com/tr",
        "analytics.twitter.com", "static.ads-twitter.com",
        "platform.linkedin.com", "snap.licdn.com",
        "sc-static.net", "tr.snapchat.com",
        "analytics.tiktok.com",
        "widgets.pinterest.com", "ct.pinterest.com",
        // OEM / Misc
        "metric.gstatic.com", "beacons.gcp.gvt2.com",
        "adsymptotic.com", "plausible.io",
        "comscore.com"
    ];

    // ================================================================
    // 2. PATH THREATS (block on ANY domain including self)
    // ================================================================
    var PATH_THREATS = [
        "/pagead.js", "/pagead/", "/pagead2.",
        "/ad_status", "/pcs/activeview",
        "/widget/ads", "/ads.js", "/ad.js",
        "/adsbygoogle.js", "/adsbygoogle.",
        "/show_ads", "/show_ad.",
        "/google_ads", "/gpt/pubads",
        "/adsense", "/afs/ads",
        "/gtag/js", "/gtm.js",
        "/analytics.js", "/ga.js",
        "/collect?", "/__utm.",
        "/hotjar", "/sentry.", "/bugsnag.",
        "/rollbar.", "/logrocket.", "/trackjs.",
        "/raygun.", "/mixpanel.", "/segment.",
        "/amplitude.", "/fullstory.", "/crazyegg.",
        "/clarity.", "/optimizely.", "/chartbeat.",
        "/newrelic.", "/metrika/",
        "/fbevents.js", "/fbpixel",
        "/banners/ad", "/banners/advmaker", "/banners/banner",
        "/ad_banner", "/ad-banner", "/ad_unit",
        "/ads/banner", "/ads/image", "/ads/flash",
        "/adserver", "/doubleclick", "/adsystem"
    ];

    // ================================================================
    // 3. BANNER KEYWORDS (from V9 — aggressive filename matching)
    // ================================================================
    var BANNER_KEYWORDS = [
        "advmaker", "468x60", "728x90", "300x250", "160x600",
        "970x250", "320x50", "336x280", "300x600", "970x90", "320x100",
        "ad_banner", "ad-banner", "ad_image", "banner_ad", "banner-ad",
        // V9 additions
        "/ads/", "/ad/", "/banner/", "/banners/", "advert", "sponsor",
        "_ad.", "-ad.", "_ads.", "-ads.", "_banner.", "-banner.",
        "advertisement", "adsense", "adserver", "adtech", "adx.",
        "flash_ad", "flashad", "swf_ad", "ad.swf", "banner.swf",
        "ad.gif", "ad.jpg", "ad.png", "banner.gif", "banner.jpg", "banner.png",
        "adv.", "advs.", "promo.", "promotional",
        "impression", "beacon", "pixel", "1x1.", "spacer."
    ];

    // ================================================================
    // 4. WHITELIST
    // ================================================================
    var WHITELIST = [
        "youtube.com/s/player", "youtube.com/iframe_api",
        "youtube.com/get_video_info", "youtube.com/youtubei",
        "youtube.com/api/stats", "youtube.com/ptracking",
        "youtube.com/api/", "youtube.com/_/",
        "youtube.com/generate_204", "youtube.com/sw.js",
        "youtube.com/videoplayback", "youtube.com/watch",
        "youtube.com/embed",
        "ytimg.com", "yt3.ggpht.com", "yt3.googleusercontent.com",
        "googlevideo.com", "ggpht.com",
        "accounts.google.com", "apis.google.com",
        "fonts.googleapis.com", "fonts.gstatic.com",
        "gstatic.com/cv", "gstatic.com/og",
        "www.gstatic.com", "ssl.gstatic.com"
    ];

    // ================================================================
    // 5. DETECTION ENGINE
    // ================================================================
    function isWhitelisted(url) {
        if (!url) return false;
        var u = url.toLowerCase();
        for (var i = 0; i < WHITELIST.length; i++) {
            if (u.indexOf(WHITELIST[i]) !== -1) return true;
        }
        return false;
    }

    function isBlocked(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.indexOf("data:") === 0 || url.indexOf("blob:") === 0 || url.indexOf("javascript:") === 0) return false;
        if (isWhitelisted(url)) return false;

        var u = url.toLowerCase();

        // On YouTube, only block external ad domains
        if (isYT) {
            if (u.indexOf("youtube.com") !== -1 || u.indexOf("googlevideo.com") !== -1 ||
                u.indexOf("ytimg.com") !== -1 || u.indexOf("ggpht.com") !== -1 ||
                u.indexOf("gstatic.com") !== -1) {
                return false;
            }
        }

        for (var i = 0; i < DOMAIN_THREATS.length; i++) {
            if (u.indexOf(DOMAIN_THREATS[i]) !== -1) return true;
        }
        for (var j = 0; j < PATH_THREATS.length; j++) {
            if (u.indexOf(PATH_THREATS[j]) !== -1) return true;
        }
        return false;
    }

    function isBannerUrl(url) {
        if (!url || typeof url !== 'string') return false;
        var u = url.toLowerCase();
        for (var i = 0; i < BANNER_KEYWORDS.length; i++) {
            if (u.indexOf(BANNER_KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    function isAdResource(url) {
        return isBlocked(url) || isBannerUrl(url);
    }

    // EL ENTERRADOR MEJORADO (Soluciona los recuadros blancos)
    function buryElement(el) {
        if (!el || !el.style) return;

        // 1. Matar el elemento
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('width', '0', 'important');
        el.style.setProperty('height', '0', 'important');

        // 2. BUSCAR Y MATAR AL PADRE (Si es una caja de anuncio)
        // Esto es lo que faltaba para pasar el test de "Visibility"
        if (el.parentElement) {
            var parent = el.parentElement;
            // Si el padre es un DIV genérico y tiene tamaño de banner o pocas cosas dentro
            if (parent.tagName === 'DIV') {
                var w = parent.offsetWidth;
                var h = parent.offsetHeight;
                // Tamaños estándar IAB (300x250, 728x90, 468x60, etc.)
                var isBannerSize = (w === 300 && h === 250) || (w === 728 && h === 90) ||
                    (w === 468 && h === 60) || (w === 160 && h === 600);

                // Si tiene tamaño de banner O solo contiene el elemento bloqueado
                if (isBannerSize || parent.children.length <= 1) {
                    parent.style.setProperty('display', 'none', 'important');
                    parent.style.setProperty('width', '0', 'important');
                    parent.style.setProperty('height', '0', 'important');
                }
            }
        }
    }

    // ================================================================
    // 6. NETWORK INTERCEPTORS (from V25 — connections must FAIL)
    // ================================================================

    // Fetch — reject
    var originalFetch = window.fetch;
    window.fetch = function () {
        try {
            var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
            if (isBlocked(url)) return Promise.reject(new TypeError('NetworkError'));
        } catch (e) { }
        return originalFetch.apply(this, arguments);
    };

    // XHR — error event
    var origXHROpen = XMLHttpRequest.prototype.open;
    var origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
        this._atomUrl = url;
        this._atomBlocked = isBlocked(url);
        if (!this._atomBlocked) return origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
        if (this._atomBlocked) {
            var self = this;
            setTimeout(function () {
                try {
                    self.dispatchEvent(new ProgressEvent('error'));
                    if (typeof self.onerror === 'function') self.onerror(new ProgressEvent('error'));
                } catch (e) { }
            }, 0);
            return;
        }
        return origXHRSend.apply(this, arguments);
    };

    // sendBeacon — return false
    if (navigator.sendBeacon) {
        var origBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url) {
            if (isBlocked(url)) return false;
            return origBeacon.apply(navigator, arguments);
        };
    }

    // Image src trap
    try {
        var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (imgDesc && imgDesc.configurable && imgDesc.set) {
            var origImgSet = imgDesc.set;
            Object.defineProperty(HTMLImageElement.prototype, 'src', {
                configurable: true, enumerable: true, get: imgDesc.get,
                set: function (val) {
                    if (val && isAdResource(val)) {
                        buryElement(this);
                        var self = this;
                        setTimeout(function () { try { self.dispatchEvent(new Event('error')); } catch (e) { } }, 0);
                        return;
                    }
                    return origImgSet.call(this, val);
                }
            });
        }
    } catch (e) { }

    // Script src trap
    try {
        var scriptDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (scriptDesc && scriptDesc.configurable && scriptDesc.set) {
            var origScriptSet = scriptDesc.set;
            Object.defineProperty(HTMLScriptElement.prototype, 'src', {
                configurable: true, enumerable: true, get: scriptDesc.get,
                set: function (val) {
                    if (val && isBlocked(val)) {
                        var self = this;
                        setTimeout(function () { try { self.dispatchEvent(new Event('error')); } catch (e) { } }, 0);
                        return;
                    }
                    return origScriptSet.call(this, val);
                }
            });
        }
    } catch (e) { }

    // Iframe src trap (not on YouTube)
    if (!isYT) {
        try {
            var iframeDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
            if (iframeDesc && iframeDesc.configurable && iframeDesc.set) {
                var origIframeSet = iframeDesc.set;
                Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
                    configurable: true, enumerable: true, get: iframeDesc.get,
                    set: function (val) {
                        if (val && isBlocked(val)) { buryElement(this); return; }
                        return origIframeSet.call(this, val);
                    }
                });
            }
        } catch (e) { }
    }

    // appendChild / insertBefore interception
    var origAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
        if (child && child.tagName === 'SCRIPT') {
            var src = child.src || child.getAttribute('src') || '';
            if (src && isBlocked(src)) {
                child.type = 'text/blocked';
                try { child.removeAttribute('src'); } catch (e) { }
                setTimeout(function () { try { child.dispatchEvent(new Event('error')); } catch (e) { } }, 10);
                return child;
            }
        }
        if (child && child.tagName === 'IMG') {
            var imgSrc = child.src || child.getAttribute('src') || '';
            if (imgSrc && isAdResource(imgSrc)) { buryElement(child); return child; }
        }
        if (child && (child.tagName === 'OBJECT' || child.tagName === 'EMBED')) {
            var objSrc = child.data || child.src || child.getAttribute('data') || child.getAttribute('src') || '';
            if (objSrc && isAdResource(objSrc)) { buryElement(child); return child; }
            var objType = child.type || child.getAttribute('type') || '';
            if (objType.indexOf('shockwave-flash') !== -1) { buryElement(child); return child; }
        }
        return origAppendChild.call(this, child);
    };

    var origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (child, ref) {
        if (child && child.tagName === 'SCRIPT') {
            var src = child.src || child.getAttribute('src') || '';
            if (src && isBlocked(src)) {
                child.type = 'text/blocked';
                try { child.removeAttribute('src'); } catch (e) { }
                setTimeout(function () { try { child.dispatchEvent(new Event('error')); } catch (e) { } }, 10);
                return child;
            }
        }
        return origInsertBefore.call(this, child, ref);
    };

    // Anti-popups
    var origWindowOpen = window.open;
    window.open = function (url) {
        if (!url || isBlocked(url)) return null;
        return origWindowOpen.apply(this, arguments);
    };

    // ================================================================
    // 7. COSMETIC SELECTORS + CSS
    // ================================================================
    var AD_SELECTORS = [
        '.ad-unit', '.ad-zone', '.ad-area', '.ad-wrap', '.ad-wrapper',
        '.ad-container', '.ad-holder', '.ad-frame', '.ad-space',
        '.ad-slot', '.ad-block', '.ad-banner', '.ad-box',
        '.adbox', '.adsbox', '.adsbygoogle',
        '.banner-ads', '.banner_ads',
        '.textads', '.text-ads', '.text_ads',
        '#ads', '#ad-container', '#ad-wrapper',
        '.advertisement', '.advertorial', '.afs_ads', '.textad',
        'ins.adsbygoogle',
        'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
        'iframe[src*="pagead"]', 'iframe[id*="google_ads"]', 'iframe[name*="google_ads"]',
        'div[data-ad-slot]', 'div[data-google-query-id]', 'div[data-ad]',
        'div[data-ad-client]', 'div[class*="content_ad"]', 'div[class*="sponsor"]',
        '[id^="google_ads"]', '[id^="div-gpt-ad"]',
        'a[href*="/ad/"]',
        'object[data*="banner"]', 'object[type*="shockwave-flash"]',
        'embed[src*="banner"]', 'embed[type*="shockwave-flash"]',
        'img[src*="advmaker"]', 'img[src*="/banners/"]',
        'img[src*="/ads/"]', 'img[src*="468x60"]',
        'img[src*="728x90"]', 'img[src*="300x250"]',
        'img[src*="pixel"]', 'img[src*="beacon"]',
        'img[width="1"][height="1"]'
    ];

    var YT_AD_SELECTORS = [
        '.video-ads', '.ytp-ad-module', 'ytd-ad-slot-renderer',
        'ytd-rich-item-renderer[is-ad]', '.ytp-ad-overlay-container',
        '.ytp-ad-text-overlay', '.ytp-ad-player-overlay',
        'ytd-banner-promo-renderer', '#masthead-ad',
        'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer',
        'ytd-display-ad-renderer', '.ytd-mealbar-promo-renderer'
    ];

    var allSelectors = AD_SELECTORS.concat(YT_AD_SELECTORS);
    var selectorStr = allSelectors.join(',');

    // ================================================================
    // 2. CSS NUCLEAR (AQUÍ ESTÁ LA SOLUCIÓN VISUAL)
    // ================================================================
    var css = `
        /* --- YOUTUBE ANTI-PANTALLA NEGRA --- */
        /* Si hay anuncio, el video se vuelve invisible instantáneamente */
        .ad-showing video { opacity: 0 !important; filter: brightness(0) !important; }
        .ad-showing .html5-video-container { opacity: 0 !important; }
        .ad-showing .ytp-ad-module { display: none !important; }
        
        /* --- YOUTUBE FEED CLEANER (Mata a Oliver Martin y Cía) --- */
        /* Oculta cualquier caja de video que contenga texto de anuncio o badges */
        ytd-rich-item-renderer:has(#ad-badge-container),
        ytd-rich-item-renderer:has(.ytd-ad-slot-renderer),
        ytd-rich-item-renderer:has(.badge-style-type-ad),
        ytd-compact-video-renderer:has(#ad-badge-container),
        ytd-ad-slot-renderer,
        ytd-banner-promo-renderer,
        ytd-promoted-sparkles-web-renderer,
        #masthead-ad {
            display: none !important; 
            width: 0 !important; 
            height: 0 !important;
            min-height: 0 !important;
        }

        /* --- LIMPIEZA DE HUECOS (Block Visibility) --- */
        /* Si un div contiene un objeto flash o iframe bloqueado, se oculta el padre */
        div:has(> object), div:has(> embed), div:has(> iframe[src*="ads"]) {
            display: none !important; width: 0 !important; height: 0 !important;
        }
        
        /* --- GENÉRICOS --- */
        .ad-unit, .ad-zone, .banner-ads, #ads, .advertisement, 
        iframe[src*="googleads"], iframe[src*="doubleclick"]
        { display: none !important; width: 0 !important; height: 0 !important; }
    `;

    function injectCSS() {
        var s = document.createElement('style');
        s.id = 'atom-shield-css';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCSS);
    else injectCSS();

    // ================================================================
    // 8. MUTATION OBSERVER
    // ================================================================
    var obs = new MutationObserver(function (muts) {
        for (var m = 0; m < muts.length; m++) {
            var nodes = muts[m].addedNodes;
            for (var n = 0; n < nodes.length; n++) {
                var node = nodes[n];
                if (node.nodeType !== 1) continue;
                try {
                    var tag = node.tagName;
                    var src = node.src || node.data || node.getAttribute('src') || node.getAttribute('data') || '';

                    // Script
                    if (tag === 'SCRIPT' && src && isBlocked(src)) {
                        node.type = 'text/blocked'; node.removeAttribute('src'); node.textContent = '';
                        continue;
                    }
                    // Image
                    if (tag === 'IMG' && src && isAdResource(src)) {
                        node.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        buryElement(node);
                        continue;
                    }
                    // Iframe
                    if (tag === 'IFRAME' && src && isBlocked(src)) {
                        node.src = 'about:blank'; buryElement(node);
                        continue;
                    }
                    // Object/Embed
                    if ((tag === 'OBJECT' || tag === 'EMBED') && isAdResource(src)) {
                        if (node.data) node.data = '';
                        buryElement(node);
                        continue;
                    }
                    // Link
                    if (tag === 'LINK') {
                        var href = node.href || '';
                        if (href && isBlocked(href)) { node.remove(); continue; }
                    }

                    // Cosmetic match
                    if (node.matches && node.matches(selectorStr)) buryElement(node);
                    if (node.querySelectorAll) {
                        var found = node.querySelectorAll(selectorStr);
                        for (var i = 0; i < found.length; i++) buryElement(found[i]);
                    }
                } catch (e) { }
            }
        }
    });

    function startObs() {
        if (!document.body) return;
        obs.observe(document.body, { childList: true, subtree: true });
        // Initial cleanup
        try { document.querySelectorAll(selectorStr).forEach(buryElement); } catch (e) { }
        try {
            document.querySelectorAll('img').forEach(function (img) {
                if (img.src && isAdResource(img.src)) { buryElement(img); img.removeAttribute('src'); }
            });
            document.querySelectorAll('object, embed').forEach(function (el) {
                var s = el.data || el.src || el.getAttribute('data') || el.getAttribute('src') || '';
                var t = el.type || el.getAttribute('type') || '';
                if (isAdResource(s) || t.indexOf('shockwave-flash') !== -1) buryElement(el);
            });
        } catch (e) { }
    }
    // Start ASAP — observe documentElement first, then body
    try { obs.observe(document.documentElement || document, { childList: true, subtree: true }); } catch (e) { }
    if (document.body) startObs();
    else document.addEventListener('DOMContentLoaded', startObs);

    // ================================================================
    // 9. THE EXECUTOR (periodic cleanup)
    // ================================================================
    setInterval(function () {
        try {
            // A. Cosmetic cleanup
            document.querySelectorAll(selectorStr).forEach(buryElement);

            // B. Ad images
            document.querySelectorAll('img').forEach(function (img) {
                if (img.src && isAdResource(img.src) && img.offsetParent !== null) buryElement(img);
            });

            // C. FLASH KILLER (from V9) — hide objects/embeds and walk up parent chain
            document.querySelectorAll('object, embed').forEach(function (el) {
                var s = el.data || el.src || el.getAttribute('data') || el.getAttribute('src') || '';
                var t = el.type || el.getAttribute('type') || '';
                if (isAdResource(s) || t.indexOf('shockwave-flash') !== -1) {
                    buryElement(el);
                    // Walk up parents (V9 logic)
                    var parent = el.parentElement;
                    while (parent && parent !== document.body) {
                        if (parent.tagName === 'DIV' && parent.children.length <= 2) {
                            buryElement(parent);
                        }
                        parent = parent.parentElement;
                    }
                }
            });

            // D. IAB SIZE HUNTER (from V9 — improved, not on YouTube)
            if (!isYT) {
                var iabSizes = [
                    [728, 90], [300, 250], [160, 600], [468, 60], [970, 250],
                    [320, 50], [336, 280], [300, 600], [970, 90], [320, 100],
                    [300, 50], [250, 250], [200, 200], [120, 600]
                ];
                document.querySelectorAll('div, iframe, ins, object, embed').forEach(function (el) {
                    if (el.offsetParent === null) return;
                    var w = el.offsetWidth, h = el.offsetHeight;
                    for (var s = 0; s < iabSizes.length; s++) {
                        if (Math.abs(w - iabSizes[s][0]) < 5 && Math.abs(h - iabSizes[s][1]) < 5) {
                            // V9: more aggressive — hide if iframe, empty, or contains ad elements
                            if (el.tagName === 'IFRAME' || el.tagName === 'INS' ||
                                el.tagName === 'OBJECT' || el.tagName === 'EMBED' ||
                                el.children.length === 0 ||
                                el.querySelector('iframe, object, embed, ins.adsbygoogle') ||
                                (el.innerText || '').length < 10) {
                                buryElement(el);
                                if (el.parentElement) buryElement(el.parentElement);
                            } else {
                                var cn = (el.className || '').toLowerCase();
                                var id = (el.id || '').toLowerCase();
                                if (cn.indexOf('ad') !== -1 || id.indexOf('ad') !== -1 ||
                                    cn.indexOf('banner') !== -1 || cn.indexOf('sponsor') !== -1) {
                                    buryElement(el);
                                }
                            }
                            break;
                        }
                    }
                });
            }

            // E. Ad text cleanup (from V9)
            document.querySelectorAll('div, span').forEach(function (el) {
                if (el.offsetParent !== null && (el.innerText || '').length < 30) {
                    var text = (el.innerText || '').toLowerCase().trim();
                    if (text === 'advertisement' || text === 'sponsored' || text === 'ad' ||
                        text === 'patrocinado' || text === 'publicidad' || text === 'anuncio') {
                        buryElement(el);
                        if (el.parentElement) buryElement(el.parentElement);
                    }
                }
            });
        } catch (e) { }
    }, isYT ? 100 : 200);

    // ================================================================
    // 10. YOUTUBE AD ROBOT (V18 PHANTOM MODE)
    // ================================================================
    if (isYT) {
        // Usamos un observer específico para la clase 'ad-showing' del reproductor
        // Esto es mucho más rápido que un setInterval
        function initYTSkip() {
            var player = document.querySelector('#movie_player');
            if (player) {
                new MutationObserver(function (mutations) {
                    if (player.classList.contains('ad-showing')) {
                        // El CSS ya oculta el video (opacity: 0). Nosotros hacemos la lógica:
                        var v = document.querySelector('video');
                        if (v) {
                            v.muted = true;
                            // Salto al final - 0.1s
                            if (!isNaN(v.duration)) v.currentTime = v.duration;
                            v.playbackRate = 16.0;
                        }
                        // Clickar botones
                        var btns = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
                        btns.forEach(b => b.click());
                    }
                }).observe(player, { attributes: true, attributeFilter: ['class'] });
            } else {
                setTimeout(initYTSkip, 500); // Reintentar si no cargó aún
            }
        }
        initYTSkip();
        // Intervalo de respaldo para el Feed (scroll infinito)
        setInterval(function () {
            try {
                // Skip buttons (Fallback)
                document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button').forEach(function (b) { b.click(); });

                // Fast-forward ad video (Fallback)
                var p = document.querySelector('#movie_player');
                if (p && p.classList.contains('ad-showing')) {
                    var v = document.querySelector('video');
                    if (v && v.duration && isFinite(v.duration)) v.currentTime = v.duration;
                    document.querySelectorAll('.ytp-ad-overlay-close-button').forEach(function (b) { b.click(); });
                }

                // Clean YT sponsored items
                document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer').forEach(function (el) {
                    var txt = (el.innerText || "").toUpperCase();
                    if (txt.includes("PATROCINADO") || txt.includes("SPONSORED") || txt.includes("PUBLICIDAD")) {
                        buryElement(el);
                    }
                });

                // Cerrar popups de "Hazte Premium"
                var dialogs = document.querySelectorAll('ytd-popup-container, ytd-mealbar-promo-renderer');
                dialogs.forEach(function (d) { d.style.display = 'none'; });
            } catch (e) { }
        }, 500);
    }

    // ================================================================
    // 11. GLOBAL MOCKS (V25 base + V9 extended)
    // ================================================================
    try {
        var noop = function () { };

        // --- Google Analytics ---
        window.ga = Object.assign(noop, {
            create: noop, getByName: noop, getAll: function () { return []; },
            remove: noop, loaded: true, q: [], l: Date.now()
        });
        window.gtag = function () { };
        window.google_tag_manager = {};
        window.dataLayer = []; window.dataLayer.push = noop;
        window.GoogleAnalyticsObject = 'ga';
        window.__gtagTracker = noop;
        window.google_tag_data = {};

        // --- Facebook Pixel ---
        window.fbq = Object.assign(noop, { callMethod: noop, queue: [], push: noop, loaded: true, version: '2.0' });
        window._fbq = window.fbq;
        window.fbAsyncInit = noop;

        // --- Sentry ---
        window.Sentry = {
            init: noop, captureException: noop, captureMessage: noop, captureEvent: noop,
            configureScope: noop,
            withScope: function (cb) { try { cb({ setTag: noop, setExtra: noop, setUser: noop }); } catch (e) { } },
            addBreadcrumb: noop, setUser: noop, setTag: noop, setExtra: noop, setContext: noop,
            close: function () { return Promise.resolve(); }, flush: function () { return Promise.resolve(); },
            lastEventId: function () { return ''; },
            startTransaction: function () { return { finish: noop, setTag: noop, startChild: function () { return { finish: noop }; } }; },
            getCurrentHub: function () { return { getClient: function () { return {}; }, getScope: function () { return {}; }, captureException: noop }; },
            SDK_VERSION: '0.0.0', Integrations: {}, BrowserTracing: noop
        };
        window.__SENTRY__ = { hub: undefined, logger: noop, extensions: {} };

        // --- Bugsnag ---
        window.Bugsnag = {
            start: function () { return window.Bugsnag; }, notify: noop, leaveBreadcrumb: noop,
            setUser: noop, addMetadata: noop, addOnError: noop,
            getPlugin: function () { return null; }, getUser: function () { return {}; },
            isStarted: function () { return true; },
            _client: { _config: {}, _session: null }
        };
        window.bugsnagClient = window.Bugsnag;
        window.bugsnag = function () { return window.Bugsnag; };

        // --- Hotjar ---
        window.hj = Object.assign(function () { }, { q: [], identify: noop });
        window._hjSettings = { hjid: 0, hjsv: 6 };

        // --- Yandex Metrika ---
        window.ym = function () { };
        window.Ya = {
            Metrika2: function () { return { reachGoal: noop, hit: noop, params: noop }; },
            Metrika: function () { return { reachGoal: noop, hit: noop, params: noop }; }
        };

        // --- Mixpanel ---
        window.mixpanel = {
            init: noop, track: noop, identify: noop, alias: noop, set_config: noop,
            get_distinct_id: function () { return ''; },
            people: { set: noop, append: noop, union: noop, increment: noop },
            register: noop, register_once: noop, reset: noop, get_property: noop, push: noop
        };

        // --- Segment ---
        window.analytics = {
            identify: noop, track: noop, page: noop, group: noop, alias: noop,
            ready: noop, reset: noop, on: noop, once: noop, off: noop, push: noop, load: noop
        };

        // --- Microsoft Clarity ---
        window.clarity = noop;

        // --- Chartbeat ---
        window.pSUPERFLY = { init: noop, virtualPage: noop, activity: noop };
        window._sf_async_config = {};

        // --- New Relic ---
        window.newrelic = { setPageViewName: noop, setCustomAttribute: noop, addPageAction: noop, noticeError: noop, finished: noop, addRelease: noop };
        window.NREUM = { init: {}, loader_config: {}, info: {} };

        // --- Rollbar ---
        window.Rollbar = { init: noop, critical: noop, error: noop, warning: noop, info: noop, debug: noop, log: noop, configure: noop };

        // --- LogRocket ---
        window.LogRocket = { init: noop, identify: noop, track: noop, getSessionURL: noop, captureException: noop };

        // --- TrackJS ---
        window.trackJs = { configure: noop, track: noop, attempt: function (fn) { return fn(); } };
        window.TrackJS = window.trackJs;

        // --- Heap ---
        window.heap = { track: noop, identify: noop, resetIdentity: noop, load: noop, addUserProperties: noop, addEventProperties: noop, loaded: true, appid: '' };

        // --- Amplitude ---
        window.amplitude = {
            init: noop, logEvent: noop, setUserId: noop, setUserProperties: noop,
            getInstance: function () { return window.amplitude; }
        };

        // --- FullStory ---
        window.FS = { identify: noop, setUserVars: noop, event: noop, log: noop, shutdown: noop, getCurrentSessionURL: function () { return ''; } };

        // --- Optimizely ---
        window.optimizely = { push: noop };

        // --- CrazyEgg ---
        window.CE2 = {};

        // ====== V9 EXTENDED MOCKS ======

        // Twitter Pixel
        window.twq = noop;

        // Pinterest
        window.pintrk = noop;

        // LinkedIn
        window._linkedin_data_partner_ids = [];
        window.lintrk = noop;

        // Comscore
        window.COMSCORE = { beacon: noop };
        window._comscore = [];

        // Quantcast
        window.__qc = {};
        window._qevents = [];

        // Intercom
        window.Intercom = noop;
        window.intercomSettings = {};

        // Drift
        window.drift = { SNIPPET_VERSION: '0.3.1', load: noop, identify: noop, track: noop, api: {}, on: noop, off: noop, reset: noop };

        // Crisp
        window.$crisp = [];
        window.CRISP_WEBSITE_ID = '';

        // Olark
        window.olark = noop;

        // Mouseflow
        window._mfq = [];

        // Lucky Orange
        window.__lo_site_id = 0;

        // Adroll
        window.adroll = {};
        window.__adroll_loaded = true;

        // TCF / Consent
        window.__tcfapi = noop;

        // Misc
        window._hmt = [];

    } catch (e) { }
})();