use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewUrl};

// --- ESTADO ---
struct TabManager {
    tabs: HashMap<String, String>,
    active_tab: Option<String>,
    counter: u32,
}

impl TabManager {
    fn new() -> Self {
        Self {
            tabs: HashMap::new(),
            active_tab: None,
            counter: 0,
        }
    }

    fn new_id(&mut self) -> String {
        self.counter += 1;
        format!("tab-{}", self.counter)
    }
}

type TabState = Arc<Mutex<TabManager>>;

#[derive(Clone, Serialize)]
struct TabInfo {
    id: String,
    url: String,
}

// --- SCRIPT ATOM SHIELD v6.5 (Restaurado + Anti-Flash) ---
const ATOM_SHIELD_SCRIPT: &str = r#"
(function() {
    console.log("🛡️ Atom Shield v6.5: Estabilidad Restaurada");

    // LISTA DE AMENAZAS
    const THREATS = [
        "google-analytics", "doubleclick", "googletagmanager", "hotjar", 
        "yandex", "facebook.net", "sentry", "bugsnag", "advmaker",
        "scorecardresearch", "quantserve", "adroll", "taboola", "outbrain",
        "googleads", "googlesyndication", "adservice", "amazon-adsystem",
        "criteo", "moatads", "pubmatic", "rubiconproject", "openx",
        "popads", "popcash", "mgid", "adblade"
    ];

    // 1. INTERCEPTOR DE RED (Modo Silencioso - 200 OK)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0] ? args[0].toString().toLowerCase() : "";
        if (THREATS.some(w => url.includes(w))) {
            return new Response("{}", { status: 200 });
        }
        return originalFetch(...args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === "string" && THREATS.some(w => url.toLowerCase().includes(w))) {
            this.isBlocked = true;
            return;
        }
        return originalOpen.apply(this, arguments);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        if (this.isBlocked) {
            Object.defineProperty(this, 'readyState', { value: 4 });
            Object.defineProperty(this, 'status', { value: 200 });
            this.dispatchEvent(new Event('load'));
            return;
        }
        return originalSend.apply(this, arguments);
    };

    // 2. CSS DE HIERRO (Con Anti-Flash)
    const cssRules = `
        /* Flash y Plugins */
        object, embed, param { 
            display: none !important; width: 0 !important; height: 0 !important; 
        }

        /* Bloques de anuncios genéricos */
        .ad-unit, .ad-zone, .ad-slot, .banner-ads, .advertisement, #ads,
        div[id^="google_ads_"], div[id^="div-gpt-ad"],
        div[class*="content_ad"], div[class*="sponsor"],
        
        /* Elementos visuales específicos */
        iframe[src*="googleads"], iframe[src*="doubleclick"], 
        img[src*="advmaker"], img[src*="banner"], a[href*="/ad/"],
        
        /* YouTube */
        .video-ads, .ytp-ad-module, .ytp-ad-overlay-container,
        ytd-ad-slot-renderer, ytd-rich-item-renderer[is-ad]
        { display: none !important; width: 0 !important; height: 0 !important; opacity: 0 !important; pointer-events: none !important; }
    `;

    function injectCSS() {
        const style = document.createElement('style');
        style.innerHTML = cssRules;
        (document.head || document.documentElement).appendChild(style);
    }
    if (document.head) injectCSS(); else window.addEventListener('DOMContentLoaded', injectCSS);

    // 3. EL ROBOT (300ms)
    setInterval(() => {
        // A. Auto-Click Saltar Anuncio
        document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button').forEach(btn => btn.click());

        // B. Acelerar Video Anuncio
        const player = document.querySelector('#movie_player');
        if (player && player.classList.contains('ad-showing')) {
            const video = document.querySelector('video');
            if (video) {
                video.muted = true;
                video.playbackRate = 16.0;
                video.currentTime = video.duration || 0;
            }
            document.querySelectorAll('.ytp-ad-overlay-close-button').forEach(b => b.click());
        }

        // C. Cazador de Texto
        document.querySelectorAll('div, span').forEach(el => {
            if (el.offsetParent !== null && el.innerText && el.innerText.length < 25) {
                const text = el.innerText.toLowerCase().trim();
                if (text === 'advertisement' || text === 'sponsored') {
                    el.style.display = 'none';
                    if(el.parentElement) el.parentElement.style.display = 'none';
                }
            }
        });

        // D. Limpieza Feed YouTube
        document.querySelectorAll('ytd-rich-item-renderer').forEach(el => {
            if (el.innerText.toUpperCase().includes('PATROCINADO')) el.remove();
        });

    }, 300);

    // 4. ANTI-POPUPS
    window.open = function() { console.log("🚫 Popup bloqueado"); return null; };
    
    console.log("🛡️ Atom Shield v6.5: Defensas activas");
})();
"#;

// --- COMANDOS ---

#[tauri::command]
async fn create_tab(
    app: tauri::AppHandle,
    state: tauri::State<'_, TabState>,
    url: Option<String>,
) -> Result<String, String> {
    let (tab_id, old_active, initial_url) = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        let id = manager.new_id();
        let old = manager.active_tab.clone();
        let url_str = url.unwrap_or_else(|| "about:blank".to_string());
        (id, old, url_str)
    };

    if let Some(old_id) = old_active {
        if let Some(webview) = app.get_webview(&old_id) {
            let _ = webview.hide();
        }
    }

    let win = app.get_window("main").ok_or("No main window")?;
    let handle = app.clone();
    let tab_id_clone = tab_id.clone();
    let parsed_url = initial_url
        .parse()
        .unwrap_or("about:blank".parse().unwrap());

    let barra_altura = 76.0;
    let size = win.inner_size().map_err(|e| e.to_string())?;

    win.add_child(
        tauri::webview::WebviewBuilder::new(&tab_id, WebviewUrl::External(parsed_url))
            .auto_resize()
            .initialization_script(ATOM_SHIELD_SCRIPT)
            .on_page_load(move |webview, _payload| {
                if let Ok(url) = webview.url() {
                    let _ = handle.emit(
                        "url-changed",
                        TabInfo {
                            id: tab_id_clone.clone(),
                            url: url.to_string(),
                        },
                    );
                }
            }),
        tauri::LogicalPosition::new(0.0, barra_altura),
        tauri::LogicalSize::new(size.width as f64, size.height as f64 - barra_altura),
    )
    .map_err(|e| e.to_string())?;

    {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.tabs.insert(tab_id.clone(), initial_url);
        manager.active_tab = Some(tab_id.clone());
    }

    Ok(tab_id)
}

#[tauri::command]
fn close_tab(
    app: tauri::AppHandle,
    state: tauri::State<TabState>,
    tab_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;

    if !manager.tabs.contains_key(&tab_id) {
        return Err("Tab not found".to_string());
    }

    if let Some(webview) = app.get_webview(&tab_id) {
        let _ = webview.close();
    }

    manager.tabs.remove(&tab_id);

    if manager.active_tab.as_ref() == Some(&tab_id) {
        manager.active_tab = manager.tabs.keys().next().cloned();
        if let Some(ref new_active) = manager.active_tab {
            if let Some(webview) = app.get_webview(new_active) {
                let _ = webview.show();
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn switch_tab(
    app: tauri::AppHandle,
    state: tauri::State<TabState>,
    tab_id: String,
) -> Result<(), String> {
    let old_active = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        if !manager.tabs.contains_key(&tab_id) {
            return Err("Tab not found".to_string());
        }
        let old = manager.active_tab.clone();
        manager.active_tab = Some(tab_id.clone());
        old
    };

    if let Some(old) = old_active {
        if let Some(webview) = app.get_webview(&old) {
            let _ = webview.hide();
        }
    }

    if let Some(webview) = app.get_webview(&tab_id) {
        let _ = webview.show();
    }

    Ok(())
}

#[tauri::command]
fn navigate(app: tauri::AppHandle, state: tauri::State<TabState>, url: String) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let script = format!("window.location.href = '{}'", url);
            let _ = webview.eval(&script);
        }
    }
}

#[tauri::command]
fn go_back(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let _ = webview.eval("window.history.back()");
        }
    }
}

#[tauri::command]
fn go_forward(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let _ = webview.eval("window.history.forward()");
        }
    }
}

#[tauri::command]
fn reload(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let _ = webview.eval("window.location.reload()");
        }
    }
}

#[tauri::command]
fn get_active_tab(state: tauri::State<TabState>) -> Option<String> {
    let manager = state.lock().unwrap();
    manager.active_tab.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tab_state: TabState = Arc::new(Mutex::new(TabManager::new()));

    tauri::Builder::default()
        .manage(tab_state.clone())
        .invoke_handler(tauri::generate_handler![
            navigate,
            go_back,
            go_forward,
            reload,
            create_tab,
            close_tab,
            switch_tab,
            get_active_tab
        ])
        .setup(move |app| {
            let win = app.get_window("main").unwrap();

            let tab_id = {
                let mut manager = tab_state.lock().unwrap();
                let id = manager.new_id();
                manager.tabs.insert(id.clone(), "about:blank".to_string());
                manager.active_tab = Some(id.clone());
                id
            };

            let barra_altura = 76.0;
            let size = win.inner_size().unwrap();
            let handle = app.handle().clone();
            let tab_id_clone = tab_id.clone();

            let _ = win.add_child(
                tauri::webview::WebviewBuilder::new(
                    &tab_id,
                    WebviewUrl::External("about:blank".parse().unwrap()),
                )
                .auto_resize()
                .initialization_script(ATOM_SHIELD_SCRIPT)
                .on_page_load(move |webview, _payload| {
                    if let Ok(url) = webview.url() {
                        let _ = handle.emit(
                            "url-changed",
                            TabInfo {
                                id: tab_id_clone.clone(),
                                url: url.to_string(),
                            },
                        );
                    }
                }),
                tauri::LogicalPosition::new(0.0, barra_altura),
                tauri::LogicalSize::new(size.width as f64, size.height as f64 - barra_altura),
            )?;

            // Resize listener
            let app_handle = app.handle().clone();
            let state_clone = tab_state.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Resized(size) = event {
                    let barra_altura = 76.0;
                    if let Some(_window) = app_handle.get_window("main") {
                        let manager = state_clone.lock().unwrap();
                        for tab_id in manager.tabs.keys() {
                            if let Some(webview) = app_handle.get_webview(tab_id) {
                                let _ = webview
                                    .set_position(tauri::LogicalPosition::new(0.0, barra_altura));
                                let _ = webview.set_size(tauri::LogicalSize::new(
                                    size.width as f64,
                                    size.height as f64 - barra_altura,
                                ));
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
