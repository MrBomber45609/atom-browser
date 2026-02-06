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

// --- SCRIPT ATOM SHIELD v15 "The Property Trap" ---
const ATOM_SHIELD_SCRIPT: &str = r#"
(function() {
    // 🛡️ ATOM SHIELD v15
    // Estrategia: Interceptar los 'setters' de las propiedades .src antes de que el navegador actúe.
    
    const THREATS = [
        "google-analytics", "doubleclick", "googletagmanager", "hotjar", 
        "yandex", "facebook.net", "sentry", "bugsnag", "advmaker",
        "scorecardresearch", "quantserve", "adroll", "taboola", "outbrain",
        "googleads", "googlesyndication", "adservice", "amazon-adsystem",
        "criteo", "moatads", "pubmatic", "rubiconproject", "openx",
        "popads", "popcash", "mgid", "adblade", "chartbeat", "segment",
        "clarity", "mixpanel", "optimizely", "crazyegg", "adtech", "fastclick",
        "youtube.com/pagead", "pagead2", "adsense"
    ];

    // Función de chequeo rápido
    function isBlocked(url) {
        if (!url) return false;
        if (typeof url !== 'string') return false;
        const u = url.toLowerCase();
        // Permitir URLs locales o data (evita romper imágenes base64)
        if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("file:")) return false;
        return THREATS.some(t => u.includes(t));
    }

    // --- 1. THE PROPERTY TRAP (La Trampa) ---
    // Interceptamos la asignación de .src en Scripts, Iframes e Imágenes
    // Esto evita la petición de red ("Loading: Failed" ✅)
    
    function trapProperty(elementPrototype, propertyName) {
        const originalDescriptor = Object.getOwnPropertyDescriptor(elementPrototype, propertyName);
        if (!originalDescriptor) return;

        Object.defineProperty(elementPrototype, propertyName, {
            set: function(value) {
                if (isBlocked(value)) {
                    // console.log("🚫 Trampa activada:", value);
                    // Asignamos algo inocuo o nada
                    return originalDescriptor.set.call(this, ""); 
                }
                return originalDescriptor.set.call(this, value);
            },
            get: originalDescriptor.get
        });
    }

    try {
        trapProperty(HTMLScriptElement.prototype, 'src');
        trapProperty(HTMLImageElement.prototype, 'src');
        trapProperty(HTMLIFrameElement.prototype, 'src');
        trapProperty(HTMLEmbedElement.prototype, 'src');
        // Para Flash/Objects
        trapProperty(HTMLObjectElement.prototype, 'data'); 
    } catch (e) { console.error("Atom Trap Error", e); }

    // --- 2. INTERCEPTOR DE CREACIÓN DE ELEMENTOS ---
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const el = originalCreateElement.call(document, tagName);
        // Si es un elemento peligroso, lo vigilamos desde el nacimiento
        if (['SCRIPT', 'IFRAME', 'IMG', 'OBJECT', 'EMBED'].includes(tagName.toUpperCase())) {
            // Ya tiene la trampa del prototipo, pero por seguridad:
            el.addEventListener('beforescriptexecute', function(e) {
                if (isBlocked(el.src)) { e.preventDefault(); el.remove(); }
            });
        }
        return el;
    };

    // --- 3. MOCKS DE ANALYTICS (Para que no explote la web) ---
    // Muchas webs fallan si 'ga' no existe. Lo creamos falso.
    function mock(name) {
        if (!window[name]) {
            Object.defineProperty(window, name, {
                value: function() { return {}; },
                writable: false
            });
        }
    }
    mock('ga'); mock('gtag'); mock('fbg'); mock('sentry');

    // --- 4. CSS NUCLEAR (Con selector :has para limpiar huecos) ---
    const cssRules = `
        /* Flash Killer + Contenedor */
        object, embed { display: none !important; }
        div:has(> object), div:has(> embed) { display: none !important; width: 0 !important; height: 0 !important; }

        /* Ad Units vacíos */
        .ad-unit, .ad-zone, .banner-ads, #ads, .advertisement,
        iframe[src*="googleads"], iframe[src*="doubleclick"],
        .video-ads, .ytp-ad-module, ytd-ad-slot-renderer,
        ytd-rich-item-renderer[is-ad], ytd-promoted-sparkles-web-renderer
        { display: none !important; width: 0 !important; height: 0 !important; }
        
        /* Limpieza de contenedores padres que tienen anuncios */
        div:has(> iframe[src*="googleads"]), 
        div:has(> iframe[src*="doubleclick"]),
        div:has(> img[src*="advmaker"])
        { display: none !important; width: 0 !important; height: 0 !important; }
    `;
    function injectCSS() {
        const style = document.createElement('style');
        style.id = "atom-shield-css"; 
        style.innerHTML = cssRules;
        (document.head || document.documentElement).appendChild(style);
    }
    if (document.head) injectCSS(); else window.addEventListener('DOMContentLoaded', injectCSS);

    // --- 5. ROBOT YOUTUBE (Ultra Rápido 50ms) ---
    setInterval(() => {
        // 1. Clicker
        const skipBtns = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        if (skipBtns.length > 0) {
            skipBtns.forEach(b => b.click());
            console.log("⚡ Skip");
        }
        
        // 2. Acelerador + Silenciador
        const player = document.querySelector('#movie_player');
        if (player && player.classList.contains('ad-showing')) {
             const v = document.querySelector('video');
             if (v) { 
                v.muted = true; 
                // Teletransporte al final
                if (!isNaN(v.duration)) v.currentTime = v.duration; 
                v.playbackRate = 16.0;
             }
             // Cerrar overlays
             document.querySelectorAll('.ytp-ad-overlay-close-button').forEach(b => b.click());
        }

        // 3. Limpieza de Feed (Patrocinado)
        document.querySelectorAll('ytd-rich-item-renderer').forEach(el => {
            const txt = (el.innerText || "").toUpperCase();
            if (txt.includes("PATROCINADO") || txt.includes("SPONSORED")) el.remove();
        });

    }, 50); // 50ms = Reacción casi instantánea

})();
"#;

#[tauri::command]
async fn create_tab(
    app: tauri::AppHandle,
    state: tauri::State<'_, TabState>,
    url: Option<String>,
) -> Result<String, String> {
    // Gestión del ID y estado
    let (tab_id, old_active) = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        let id = manager.new_id();
        let old = manager.active_tab.clone();
        (id, old)
    };

    if let Some(old_id) = old_active {
        if let Some(webview) = app.get_webview(&old_id) {
            let _ = webview.hide();
        }
    }

    let win = app.get_window("main").ok_or("No main window")?;
    let handle = app.clone();
    let tab_id_clone = tab_id.clone();
    let initial_url = url.unwrap_or_else(|| "about:blank".to_string());
    let parsed_url = initial_url
        .parse()
        .unwrap_or("about:blank".parse().unwrap());
    let barra_altura = 90.0;
    let size = win.inner_size().map_err(|e| e.to_string())?;

    // INYECCIÓN
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
        if let Some(view) = app.get_webview(&old) {
            let _ = view.hide();
        }
    }
    if let Some(view) = app.get_webview(&tab_id) {
        let _ = view.show();
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
            reload,
            go_forward,
            create_tab,
            close_tab,
            switch_tab,
            get_active_tab
        ])
        .setup(move |app| {
            let win = app.get_window("main").unwrap();
            let handle = app.handle().clone();

            // PRIMERA TAB
            let tab_id = {
                let mut manager = tab_state.lock().unwrap();
                let id = manager.new_id();
                manager.tabs.insert(id.clone(), "about:blank".to_string());
                manager.active_tab = Some(id.clone());
                id
            };

            let barra_altura = 90.0;
            let size = win.inner_size().unwrap();
            let tab_id_clone = tab_id.clone();

            let _ = win.add_child(
                tauri::webview::WebviewBuilder::new(
                    &tab_id,
                    WebviewUrl::External("about:blank".parse().unwrap()),
                )
                .auto_resize()
                .initialization_script(ATOM_SHIELD_SCRIPT) // ¡Importante!
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

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
