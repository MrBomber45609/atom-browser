#[cfg(target_os = "windows")]
pub mod network_blocker {
    use tauri::Webview;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
    };
    use webview2_com::{take_pwstr, WebResourceRequestedEventHandler};
    use windows::core::{Interface, HSTRING, PWSTR};

    // ================================================================
    // DOMINIOS BLOQUEADOS — ~800+ dominios
    // Fuentes: EasyList, Peter Lowe's, AdGuard Base, hagezi/dns-blocklists
    // ================================================================

    // --- Redes publicitarias principales ---
    const AD_NETWORKS: &[&str] = &[
        // Google Ads ecosystem
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "googletagmanager.com",
        "google-analytics.com",
        "googletagservices.com",
        "pagead2.googlesyndication.com",
        "adservice.google.com",
        "2mdn.net",
        "adservice.google.",
        "pagead.l.doubleclick.net",
        "tpc.googlesyndication.com",
        "www-googletagmanager.l.google.com",
        "ad.doubleclick.net",
        "static.doubleclick.net",
        "m.doubleclick.net",
        "mediavisor.doubleclick.net",
        "googleads.g.doubleclick.net",
        "googleads4.g.doubleclick.net",
        "www.googleadservices.com",
        "fundingchoicesmessages.google.com",
        "imasdk.googleapis.com",        // Google IMA SDK (video ads)
        "jnn-pa.googleapis.com",
        "pagead2.googlesyndication.com",
        "s0.2mdn.net",
        // Amazon
        "amazon-adsystem.com",
        "aax.amazon-adsystem.com",
        "aax-us-east.amazon-adsystem.com",
        "aax-us-west.amazon-adsystem.com",
        "aax-eu.amazon-adsystem.com",
        "aan.amazon.com",
        "assoc-amazon.com",
        // Facebook/Meta
        "an.facebook.com",
        "pixel.facebook.com",
        "www.facebook.com/tr",
        "connect.facebook.net/en_US/fbevents.js",
        // Taboola
        "taboola.com",
        "cdn.taboola.com",
        "trc.taboola.com",
        "nr.taboola.com",
        "images.taboola.com",
        // Outbrain
        "outbrain.com",
        "widgets.outbrain.com",
        "log.outbrain.com",
        "amplify.outbrain.com",
        // Criteo
        "criteo.com",
        "criteo.net",
        "bidder.criteo.com",
        "static.criteo.net",
        "cas.criteo.com",
        "gum.criteo.com",
        "sslwidget.criteo.com",
        // Other major networks
        "popads.net",
        "popcash.net",
        "mgid.com",
        "adnxs.com",
        "adsrvr.org",
        "adform.net",
        "bidswitch.net",
        "casalemedia.com",
        "openx.net",
        "pubmatic.com",
        "rubiconproject.com",
        "sharethrough.com",
        "smartadserver.com",
        "teads.tv",
        "trafficjunky.com",
        "tribalfusion.com",
        "zergnet.com",
        "serving-sys.com",
        "innovid.com",
        "connatix.com",
        "adsafeprotected.com",
        "indexexchange.com",
        "33across.com",
        "sovrn.com",
        "lijit.com",
        "undertone.com",
        "rhythmone.com",
        "conversantmedia.com",
        "advertising.com",
        "yieldmo.com",
        "medianet.com",
        "media.net",
        "kargo.com",
        "nativo.com",
        "revcontent.com",
        "content.ad",
        "adblade.com",
        "adroll.com",
        "adtech.de",
        "adtechus.com",
        "atdmt.com",
        "bluekai.com",
        "bwp.download",
        "contextweb.com",
        "dotomi.com",
        "everesttech.net",
        "exoclick.com",
        "exponential.com",
        "eyeblaster.com",
        "flashtalking.com",
        "fwmrm.net",
        "gmossp-sp.jp",
        "gumgum.com",
        "ib-ibi.com",
        "inmobi.com",
        "ipredictive.com",
        "jivox.com",
        "liadm.com",
        "liveintent.com",
        "marketo.net",
        "mathtag.com",
        "mediavine.com",
        "moatads.com",
        "mookie1.com",
        "npttech.com",
        "omnitagjs.com",
        "perfectmarket.com",
        "petametrics.com",
        "pro-market.net",
        "quantcast.com",
        "revjet.com",
        "rlcdn.com",
        "rqtrk.eu",
        "sailthru.com",
        "securepubads.g.doubleclick.net",
        "smaato.net",
        "spotxchange.com",
        "stickyadstv.com",
        "switch.com",
        "synacor.com",
        "tidaltv.com",
        "tremorhub.com",
        "turn.com",
        "undertone.com",
        "unrulymedia.com",
        "valueclickmedia.com",
        "vidible.tv",
        "yieldoptimizer.com",
        "zemanta.com",
        "zedo.com",
        "propellerads.com",
        "juicyads.com",
        "hilltopads.net",
        "clickadu.com",
        "admaven.com",
        "adsterra.com",
        "richpush.co",
        "pushpush.net",
        "pushwoosh.com",
        "onesignal.com",
        "airpush.com",
        "leadbolt.com",
        "startapp.com",
        "unity3d.com/ads",
        "applovin.com",
        "vungle.com",
        "ironsrc.com",
        "mintegral.com",
        "inmobi.com",
        "fyber.com",
        "smaato.com",
        "chartboost.com",
    ];

    // --- Analytics y Tracking ---
    const TRACKING_DOMAINS: &[&str] = &[
        // Major analytics
        "hotjar.com",
        "static.hotjar.com",
        "script.hotjar.com",
        "mixpanel.com",
        "cdn.mxpnl.com",
        "api-js.mixpanel.com",
        "segment.com",
        "segment.io",
        "cdn.segment.com",
        "api.segment.io",
        "amplitude.com",
        "cdn.amplitude.com",
        "api.amplitude.com",
        "heapanalytics.com",
        "cdn.heapanalytics.com",
        "fullstory.com",
        "rs.fullstory.com",
        "mouseflow.com",
        "cdn.mouseflow.com",
        "crazyegg.com",
        "script.crazyegg.com",
        "optimizely.com",
        "cdn.optimizely.com",
        "logx.optimizely.com",
        "quantserve.com",
        "pixel.quantserve.com",
        "chartbeat.com",
        "static.chartbeat.com",
        "parsely.com",
        "srv.pixel.parsely.com",
        "kissmetrics.com",
        "clarity.ms",
        "newrelic.com",
        "js-agent.newrelic.com",
        "bam.nr-data.net",
        "nr-data.net",
        "sentry.io",
        "sentry-cdn.com",
        "browser.sentry-cdn.com",
        "bugsnag.com",
        "d2wy8f7a9ursnm.cloudfront.net",
        "rollbar.com",
        "logrocket.com",
        "cdn.logrocket.io",
        "trackjs.com",
        "comscore.com",
        "b.scorecardresearch.com",
        "scorecardresearch.com",
        "sb.scorecardresearch.com",
        // Additional tracking
        "alexametrics.com",
        "analytics.yahoo.com",
        "analytics.google.com",
        "bat.bing.com",
        "bidswitch.net",
        "bounceexchange.com",
        "brealtime.com",
        "c.bing.com",
        "cdn.krxd.net",
        "clicktale.net",
        "contentsquare.net",
        "conv.indeed.com",
        "coremetrics.com",
        "crwdcntrl.net",
        "d.turn.com",
        "dc.ads.linkedin.com",
        "demdex.net",
        "dpm.demdex.net",
        "ds.serving-sys.com",
        "e.liadm.com",
        "effectivemeasure.net",
        "exelator.com",
        "eyeota.net",
        "go.pardot.com",
        "hm.baidu.com",
        "id5-sync.com",
        "idsync.rlcdn.com",
        "iperceptions.com",
        "krxd.net",
        "livefyre.com",
        "lpsnmedia.net",
        "marchex.io",
        "marketo.com",
        "marin.clearfit.com",
        "matheranalytics.com",
        "mautic.com",
        "metric.gstatic.com",
        "ml314.com",
        "mplxtms.com",
        "msecnd.net",
        "myvisualiq.net",
        "navigator-lbs.navdmp.com",
        "npttech.com",
        "omtrdc.net",
        "onetag-sys.com",
        "owneriq.net",
        "pardot.com",
        "pi.pardot.com",
        "pippio.com",
        "postrelease.com",
        "pr-bh.ybp.yahoo.com",
        "pubmine.com",
        "px.spiceworks.com",
        "qualtrics.com",
        "quantcount.com",
        "rfihub.com",
        "rkdms.com",
        "s.amazon-adsystem.com",
        "sb.voicefive.com",
        "sc.omtrdc.net",
        "stat.aldi.us",
        "stats.g.doubleclick.net",
        "stochasticgeo.com",
        "survey.g.doubleclick.net",
        "tag.demandbase.com",
        "tags.bkrtx.com",
        "tags.bluekai.com",
        "tags.tiqcdn.com",
        "targeting.api.drift.com",
        "tealiumiq.com",
        "tk.kargo.com",
        "tlx.3lift.com",
        "tr.snapchat.com",
        "trk.pinterest.com",
        "tt.onthe.io",
        "us-u.openx.net",
        "usabilla.com",
        "visitor-service.tealiumiq.com",
        "w55c.net",
        "widgets.pinterest.com",
        "wt-eu02.net",
        "x.bidswitch.net",
        "yieldlab.net",
        "zeotap.com",
        "zqtk.net",
    ];

    // --- Social tracking ---
    const SOCIAL_TRACKING: &[&str] = &[
        "pixel.facebook.com",
        "analytics.twitter.com",
        "ads-twitter.com",
        "ads-api.twitter.com",
        "analytics.twitter.com",
        "static.ads-twitter.com",
        "snap.licdn.com",
        "analytics.tiktok.com",
        "ads.tiktok.com",
        "analytics-sg.tiktok.com",
        "ct.pinterest.com",
        "widgets.pinterest.com",
        "log.pinterest.com",
        "t.co/i/adsct",
        "ads.reddit.com",
        "events.reddit.com",
        "rereddit.com",
        "alb.reddit.com",
        "d.reddit.com",
        "www.redditstatic.com/ads",
        "ad.snooper.reddit.com",
    ];

    // --- Dominios de malware/scam comunes ---
    const MALWARE_DOMAINS: &[&str] = &[
        "adf.ly",
        "shorte.st",
        "sh.st",
        "bc.vc",
        "linkshrink.net",
        "ouo.io",
        "ouo.press",
        "adcash.com",
        "adk2.co",
        "clicksor.com",
        "directrev.com",
        "jmp.click",
        "linkbucks.com",
        "popunder.net",
        "wigetmedia.com",
        "redirect.viglink.com",
        "viglink.com",
        "skimresources.com",
        "a-ads.com",
        "coinad.com",
        "coinhive.com",
        "coin-hive.com",
        "minero.cc",
        "jsecoin.com",
        "authedmine.com",
        "cryptoloot.pro",
        "2giga.link",
        "megaurl.in",
        "exe.io",
        "cpmlink.net",
        "xyzads.com",
    ];

    // --- Popups y redirects ---
    const POPUP_DOMAINS: &[&str] = &[
        "popads.net",
        "popcash.net",
        "propellerads.com",
        "popmyads.com",
        "popunderjs.com",
        "popuptraffic.com",
        "richpush.co",
        "push.express",
        "pushpush.net",
        "pushame.com",
        "pushengage.com",
        "sendpulse.com",
        "gravitec.net",
        "pushassist.com",
        "subscribers.com",
        "izooto.com",
    ];

    // --- CNAME cloaking domains (trackers que se disfrazan de first-party) ---
    const CNAME_TRACKERS: &[&str] = &[
        "adobedc.net",
        "at-o.net",
        "bounceexchange.com",
        "brealtime.com",
        "c.evidon.com",
        "dnsdelegation.io",
        "eulerian.net",
        "go-mpulse.net",
        "mplxtms.com",
        "omtrdc.net",
        "pardot.com",
        "webcontentassessor.com",
    ];

    // ================================================================
    // WHITELIST — Dominios necesarios para funcionalidad
    // ================================================================

    // Dominios que SIEMPRE se whitelistean (en cualquier sitio)
    const ALWAYS_WHITELISTED: &[&str] = &[
        "accounts.google.com",
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        "ajax.googleapis.com",
        "maps.googleapis.com",
        "translate.googleapis.com",
    ];

    // ================================================================
    // LÓGICA DE BLOQUEO
    // ================================================================

    fn should_block(url: &str) -> bool {
        let lower = url.to_lowercase();

        // 1. Dominios siempre permitidos
        for wd in ALWAYS_WHITELISTED {
            if lower.contains(wd) {
                return false;
            }
        }

        // 2. Google/YouTube ecosystem — NUNCA bloquear a nivel de red.
        //    Razón: YouTube verifica la integridad de las respuestas.
        //    Bloquear doubleclick/googlesyndication/etc rompe el player.
        //    Los ads de Google en otros sitios se manejan vía atom_shield.js
        //    (GPT mock, IMA mock, adsbygoogle mock, CSS cosmetic rules).
        let google_ad_domains = [
            "doubleclick.net", "googlesyndication.com", "googleadservices.com",
            "googletagmanager.com", "google-analytics.com", "googletagservices.com",
            "2mdn.net", "imasdk.googleapis.com", "adservice.google.",
            "fundingchoicesmessages.google.com", "pagead2.googlesyndication.com",
            "tpc.googlesyndication.com", "www.googletagmanager.com",
            "jnn-pa.googleapis.com",
        ];
        for gd in &google_ad_domains {
            if lower.contains(gd) {
                return false; // Dejar pasar — JS se encarga
            }
        }

        // 3. Redes publicitarias NO-Google — bloquear siempre
        for d in AD_NETWORKS {
            // Skip any Google domains in the list
            if d.contains("doubleclick") || d.contains("googlesyndication") ||
               d.contains("googleadservices") || d.contains("googletagmanager") ||
               d.contains("google-analytics") || d.contains("googletagservices") ||
               d.contains("2mdn") || d.contains("imasdk") ||
               d.contains("adservice.google") || d.contains("fundingchoices") ||
               d.contains("jnn-pa") {
                continue;
            }
            if lower.contains(d) {
                return true;
            }
        }

        // 4. Tracking/Analytics
        for d in TRACKING_DOMAINS {
            if lower.contains(d) {
                return true;
            }
        }

        // 5. Social tracking
        for d in SOCIAL_TRACKING {
            if lower.contains(d) {
                return true;
            }
        }

        // 6. Malware/Scam
        for d in MALWARE_DOMAINS {
            if lower.contains(d) {
                return true;
            }
        }

        // 7. Popups
        for d in POPUP_DOMAINS {
            if lower.contains(d) {
                return true;
            }
        }

        // 8. CNAME trackers
        for d in CNAME_TRACKERS {
            if lower.contains(d) {
                return true;
            }
        }

        // 9. Reglas genéricas por patrón de URL
        if matches_generic_ad_pattern(&lower) {
            return true;
        }

        false
    }

    /// Reglas genéricas: patrones en URLs que suelen ser ads/tracking
    fn matches_generic_ad_pattern(url: &str) -> bool {
        // Patrones comunes en URLs de publicidad
        let patterns = [
            "/adserver",
            "/adrequest",
            "/adchoices",
            "/ad_frame",
            "/ad_banner",
            "/adview",
            "/adsense",
            "/adunit",
            "/ad-script",
            "/ad-iframe",
            "/admanager",
            "/adsapi",
            "ad_click",
            "click.php?ad",
            "/tracker.php",
            "/tracking.js",
            "/pixel.gif",
            "/pixel.png",
            "/beacon.gif",
            "/beacon.js",
            "/collect?v=",      // GA collect endpoint
            "/analytics.js",
            "/gtag/js",
            "/__utm.gif",
            "/pageview?",
            "/conversion/",
            "/aclk?",
            "/pcs/view",
            "smartad",
            "sponsoredlink",
            "/sponsor/",
        ];

        for p in &patterns {
            if url.contains(p) {
                return true;
            }
        }

        false
    }

    // ================================================================
    // SETUP — Interceptor de red WebView2
    // ================================================================

    pub fn setup_network_blocker(webview: &Webview) {
        let _ = webview.with_webview(move |wv| {
            unsafe {
                let controller = wv.controller();
                let core = controller.CoreWebView2().unwrap();

                let core2: ICoreWebView2_2 = core.cast().unwrap();
                let env = core2.Environment().unwrap();

                let filter = HSTRING::from("*");
                core.AddWebResourceRequestedFilter(
                    &filter,
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                )
                .unwrap();

                let mut token: i64 = 0;
                core.add_WebResourceRequested(
                    &WebResourceRequestedEventHandler::create(Box::new(
                        move |_sender, args| {
                            if let Some(args_obj) = args {
                                let request = args_obj.Request()?;
                                let mut uri_ptr = PWSTR::null();
                                request.Uri(&mut uri_ptr)?;
                                let uri = take_pwstr(uri_ptr);

                                if should_block(&uri) {
                                    let reason = HSTRING::from("OK");
                                    let headers = HSTRING::from(
                                        "Content-Type: text/plain\r\n\
                                         Content-Length: 0\r\n\
                                         Access-Control-Allow-Origin: *\r\n\
                                         Cache-Control: no-cache"
                                    );
                                    if let Ok(response) = env.CreateWebResourceResponse(
                                        None::<&windows::Win32::System::Com::IStream>,
                                        200,
                                        &reason,
                                        &headers,
                                    ) {
                                        let _ = args_obj.SetResponse(&response);
                                    }
                                }
                            }
                            Ok(())
                        },
                    )),
                    &mut token,
                )
                .unwrap();
            }
        });
    }
}