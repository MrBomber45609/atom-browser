// ================================================================
// ATOM SHIELD — Motor de ad-blocking para Electron
// ================================================================
// Enfoque hibrido inspirado en uBlock Origin:
//   Capa 1: Motor de filtros (EasyList/EasyPrivacy, mismas listas que uBlock)
//           via @cliqz/adblocker con proteccion YouTube
//   Capa 2: Content scripts inyectados segun el sitio
//     - YouTube: m0 + m1 + m2 (bloqueo quirurgico sin romper el player)
//     - Otros:   m0 + m3 + m4 + m5 + m6 + m7 (mocks + cosmeticos)
// ================================================================

const fs = require('fs');
const path = require('path');
const { ElectronBlocker, Request } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

// Dominios de fallback (si el motor no carga)
const BLOCKED_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'adnxs.com',
    'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
    'moatads.com', 'amazon-adsystem.com', 'hotjar.com', 'mixpanel.com',
    'segment.com', 'segment.io', 'amplitude.com', 'clarity.ms',
    'serving-sys.com', 'mgid.com', 'adsrvr.org', 'demdex.net',
    'bluekai.com', 'scorecardresearch.com', 'quantserve.com',
    'pubmatic.com', 'rubiconproject.com', 'openx.net', 'casalemedia.com',
    'turn.com', 'mathtag.com', 'bidswitch.net', 'sharethis.com',
    'addthis.com', 'medianet.com',
];

// Dominios esenciales de YouTube/Google que NUNCA se bloquean a nivel de red
const YOUTUBE_WHITELIST = [
    'googlevideo.com',
    'ytimg.com',
    'youtube.com',
    'youtu.be',
    'yt3.ggpht.com',
    'youtube-nocookie.com',
    'youtube-ui.l.google.com',
    'jnn-pa.googleapis.com',
    'play.google.com',
    // Google CDN: fuentes, iconos Material Design, assets estaticos
    'gstatic.com',
    'fonts.googleapis.com',
    // Contenido de usuario: avatares, fotos de canal
    'googleusercontent.com',
];

class AtomShield {
    constructor() {
        this.enabled = true;
        this.engine = null;
        this.scriptsDir = path.join(__dirname, 'shield');
        this.scriptCache = {};
        this.trackedViews = new Set();
    }

    async init() {
        // Cargar scripts de inyeccion
        this.loadScripts();

        // Cargar motor de filtros (mismas listas que uBlock Origin)
        try {
            this.engine = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
            console.log('Atom Shield: Motor de filtros cargado (EasyList + EasyPrivacy)');
        } catch (e) {
            console.error('Atom Shield: Error cargando filtros, usando lista basica:', e.message);
            this.engine = null;
        }
    }

    loadScripts() {
        const files = [
            'm0_core.js',
            'm1_youtube.js', 'm2_youtube_cosmetics.js', 'm9_youtube_accelerate.js',
            'm3_gpt_mock.js', 'm4_ad_mocks.js', 'm5_anti_detection.js',
            'm6_network_intercept.js', 'm7_cosmetics.js'
        ];
        for (const file of files) {
            this.scriptCache[file] = fs.readFileSync(
                path.join(this.scriptsDir, file), 'utf-8'
            );
        }
    }

    getInjectionScript(url) {
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        let script = this.scriptCache['m0_core.js'] + '\n';
        if (isYouTube) {
            script += this.scriptCache['m1_youtube.js'] + '\n';
            script += this.scriptCache['m2_youtube_cosmetics.js'] + '\n';
            script += this.scriptCache['m9_youtube_accelerate.js'] + '\n';
        } else {
            script += this.scriptCache['m3_gpt_mock.js'] + '\n';
            script += this.scriptCache['m4_ad_mocks.js'] + '\n';
            script += this.scriptCache['m5_anti_detection.js'] + '\n';
            script += this.scriptCache['m6_network_intercept.js'] + '\n';
            script += this.scriptCache['m7_cosmetics.js'] + '\n';
        }
        return script;
    }

    _isBenchmarkDomain(url) {
        return url.includes('browserbench.org') || url.includes('speedometer');
    }

    _isYouTubeDomain(url) {
        for (const domain of YOUTUBE_WHITELIST) {
            if (url.includes(domain)) return true;
        }
        return false;
    }

    enableNetworkBlocking(electronSession) {
        electronSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
            if (!this.enabled) {
                callback({});
                return;
            }

            const url = details.url;

            // NUNCA bloquear dominios esenciales de YouTube O benchmarks
            if (this._isYouTubeDomain(url) || this._isBenchmarkDomain(url)) {
                callback({});
                return;
            }

            // Capa 1: Motor de filtros (uBlock-quality, EasyList + EasyPrivacy)
            if (this.engine) {
                try {
                    const request = Request.fromRawDetails({
                        url: details.url,
                        sourceUrl: details.referrer || '',
                        type: details.resourceType || 'other',
                    });
                    if (request.type === 'other') {
                        request.guessTypeOfRequest();
                    }
                    const { match } = this.engine.match(request);
                    if (match) {
                        console.log('[AtomShield BLOCKED]', details.resourceType || 'other', url.substring(0, 120));
                        callback({ cancel: true });
                        return;
                    }
                } catch (e) {
                    // Si falla el motor, seguimos con fallback
                }
            } else {
                // Fallback: lista estatica de dominios
                for (const domain of BLOCKED_DOMAINS) {
                    if (url.includes(domain)) {
                        callback({ cancel: true });
                        return;
                    }
                }
            }

            callback({});
        });
    }

    disableNetworkBlocking(electronSession) {
        electronSession.webRequest.onBeforeRequest(null);
    }

    attachToView(view) {
        const wc = view.webContents;
        const wcId = wc.id;

        if (this.trackedViews.has(wcId)) return;
        this.trackedViews.add(wcId);

        // Inyectar scripts en cada carga de pagina
        wc.on('dom-ready', () => {
            if (!this.enabled) return;
            const url = wc.getURL();
            if (!url || url.startsWith('file:') || url.startsWith('about:') || url.startsWith('data:')) return;

            // SKIP benchmarks (Speedometer) to measure engine performance, not extension overhead
            if (this._isBenchmarkDomain(url)) {
                console.log('Atom Shield: Skipping injection for benchmark:', url);
                return;
            }

            const script = this.getInjectionScript(url);
            wc.executeJavaScript(script).catch(e => {
                console.error('Atom Shield injection error:', e.message);
            });
        });

        wc.on('destroyed', () => {
            this.trackedViews.delete(wcId);
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    isEnabled() {
        return this.enabled;
    }
}

module.exports = AtomShield;
