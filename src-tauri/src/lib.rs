use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewUrl};

// --- CONSTANTES ---
const BARRA_ALTURA: f64 = 72.0;

mod ad_blocker;

// --- SCRIPTS DE SEGURIDAD (MODULARES) ---
// Each module is a self-contained IIFE that only runs where needed.
// Order matters: m0_core must be first (defines __atomShield).
const SHIELD_SCRIPTS: &[&str] = &[
    include_str!("../scripts/m0_core.js"),           // Utilities (always)
    include_str!("../scripts/m1_youtube.js"),         // YT ad stripping (YT only)
    include_str!("../scripts/m2_youtube_cosmetics.js"), // YT cosmetics (YT only)
    include_str!("../scripts/m3_gpt_mock.js"),        // GPT mock (non-YT)
    include_str!("../scripts/m4_ad_mocks.js"),        // IMA/Amazon/etc (non-YT)
    include_str!("../scripts/m5_anti_detection.js"),  // Anti-adblock (non-YT)
    include_str!("../scripts/m6_network_intercept.js"), // Fetch/XHR (non-YT)
    include_str!("../scripts/m7_cosmetics.js"),       // CSS rules (non-YT)
];

// --- ESTADO ---
struct TabManager {
    tabs: HashMap<String, String>,
    active_tab: Option<String>,
    counter: u32,
    is_fullscreen: bool,
    pre_fs_pos: Option<(i32, i32)>,
    pre_fs_size: Option<(u32, u32)>,
}

impl TabManager {
    fn new() -> Self {
        Self {
            tabs: HashMap::new(),
            active_tab: None,
            counter: 0,
            is_fullscreen: false,
            pre_fs_pos: None,
            pre_fs_size: None,
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

// ================================================================
// INYECCIÓN TEMPRANA DEL SCRIPT — WebView2 nativo
// ================================================================
// AddScriptToExecuteOnDocumentCreated ejecuta el script ANTES de que
// cualquier script de la página se ejecute. Se registra UNA VEZ y
// se aplica a todas las navegaciones futuras + iframes del main frame.
//
// IMPORTANTE: No se inyecta en iframes sandboxed (about:blank sin
// allow-scripts) — eso causaba los errores anteriores. WebView2
// maneja esto automáticamente: solo inyecta donde está permitido.
// ================================================================

#[cfg(target_os = "windows")]
fn inject_shield_early(webview: &tauri::Webview) {
    use windows::core::HSTRING;

    // Concatenar todos los módulos en un solo string
    let mut combined = String::new();
    for script in SHIELD_SCRIPTS {
        combined.push_str(script);
        combined.push('\n');
    }

    let _ = webview.with_webview(move |wv| {
        unsafe {
            let controller = wv.controller();
            let core = controller.CoreWebView2().unwrap();

            let hscript = HSTRING::from(combined);
            let handler = webview2_com::AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(
                Box::new(|_hr, _id| Ok(())),
            );
            let _ = core.AddScriptToExecuteOnDocumentCreated(&hscript, &handler);
        }
    });
}

#[cfg(not(target_os = "windows"))]
fn inject_shield_early(webview: &tauri::Webview) {
    for script in SHIELD_SCRIPTS {
        let _ = webview.eval(*script);
    }
}

// ================================================================
// INYECCIÓN DE RESPALDO — on_page_load
// ================================================================
// Red de seguridad para SPA navigations y recargas.
// Los módulos usan IIFEs, así que la doble ejecución es segura.
// ================================================================

fn inject_shield_fallback(webview: &tauri::Webview) {
    for script in SHIELD_SCRIPTS {
        let _ = webview.eval(*script);
    }
}

// ================================================================
// COMANDOS TAURI
// ================================================================

#[tauri::command]
async fn create_tab(
    app: tauri::AppHandle,
    state: tauri::State<'_, TabState>,
    url: Option<String>,
) -> Result<String, String> {
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

    let load_tab_id = tab_id.clone();

    let stored_url = url.clone().unwrap_or_else(|| "atom://home".to_string());

    let webview_url = match url {
        Some(u) if !u.is_empty() => {
            let parsed = u.parse().unwrap_or_else(|_| "about:blank".parse().unwrap());
            WebviewUrl::External(parsed)
        }
        _ => WebviewUrl::App("home.html".into()),
    };

    let size = win.inner_size().map_err(|e| e.to_string())?;

    let webview = win
        .add_child(
            tauri::webview::WebviewBuilder::new(&tab_id, webview_url)
                .auto_resize()
                .on_download(move |webview, event| match event {
                    tauri::webview::DownloadEvent::Requested { url, destination } => {
                        let filename = destination
                            .file_name()
                            .map(|f| f.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let _ = webview.app_handle().emit(
                            "download-started",
                            serde_json::json!({
                                "id": url.to_string(),
                                "filename": filename,
                                "path": destination.to_string_lossy()
                            }),
                        );
                        true
                    }
                    tauri::webview::DownloadEvent::Finished { url, success, .. } => {
                        let _ = webview.app_handle().emit(
                            "download-finished",
                            serde_json::json!({
                                "id": url.to_string(),
                                "success": success
                            }),
                        );
                        true
                    }
                    _ => true,
                })
                .on_navigation(move |_url| {
                    true
                })
                .on_page_load(move |webview, _payload| {
                    // Respaldo: inyectar shield por si la inyección temprana falló
                    // Esto cubre recargas y navegaciones SPA
                    inject_shield_fallback(&webview);

                    if let Ok(url) = webview.url() {
                        let _ = webview.app_handle().emit(
                            "url-changed",
                            TabInfo {
                                id: load_tab_id.clone(),
                                url: url.to_string(),
                            },
                        );
                    }
                }),
            tauri::LogicalPosition::new(0.0, BARRA_ALTURA),
            tauri::LogicalSize::new(size.width as f64, size.height as f64 - BARRA_ALTURA),
        )
        .map_err(|e| e.to_string())?;

    // --- ORDEN CRÍTICO ---
    // 1. Primero: inyección temprana del shield (antes de cualquier navegación)
    inject_shield_early(&webview);

    // 2. Segundo: bloqueador de red (intercepta peticiones HTTP)
    #[cfg(target_os = "windows")]
    crate::ad_blocker::network_blocker::setup_network_blocker(&webview);

    {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.tabs.insert(tab_id.clone(), stored_url);
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
            // Usar eval para navegar — el shield se re-inyecta vía on_page_load
            // y la inyección temprana (AddScriptToExecuteOnDocumentCreated) ya está
            // registrada y se ejecutará automáticamente en la nueva página
            let script = format!("window.location.href = '{}'", url.replace('\'', "\\'"));
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
async fn set_fullscreen(
    app: tauri::AppHandle,
    state: tauri::State<'_, TabState>,
    is_fullscreen: bool,
) -> Result<(), String> {
    let win = app.get_window("main").ok_or("No main window")?;

    if is_fullscreen {
        {
            let mut manager = state.lock().map_err(|e| e.to_string())?;
            if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                manager.pre_fs_pos = Some((pos.x, pos.y));
                manager.pre_fs_size = Some((size.width, size.height));
            }
            manager.is_fullscreen = true;
        }

        let _ = app.emit_to("main", "fullscreen-change", true);
        std::thread::sleep(std::time::Duration::from_millis(300));

        if let Ok(Some(monitor)) = win.current_monitor() {
            let m_pos = monitor.position();
            let m_size = monitor.size();
            let _ = win.set_always_on_top(true);
            let _ = win.set_position(tauri::PhysicalPosition::new(m_pos.x, m_pos.y));
            let _ = win.set_size(tauri::PhysicalSize::new(m_size.width, m_size.height));
        }

        std::thread::sleep(std::time::Duration::from_millis(50));
        if let Ok(size) = win.inner_size() {
            let manager = state.lock().map_err(|e| e.to_string())?;
            let w = size.width as f64;
            let h = size.height as f64;
            for (id, _) in manager.tabs.iter() {
                if let Some(wv) = win.get_webview(id) {
                    let _ = wv.set_bounds(tauri::Rect {
                        position: tauri::Position::Logical(tauri::LogicalPosition {
                            x: 0.0,
                            y: 0.0,
                        }),
                        size: tauri::Size::Logical(tauri::LogicalSize {
                            width: w,
                            height: h,
                        }),
                    });
                }
            }
        }
    } else {
        let _ = win.set_always_on_top(false);

        let (prev_pos, prev_size) = {
            let mut manager = state.lock().map_err(|e| e.to_string())?;
            manager.is_fullscreen = false;
            (manager.pre_fs_pos.take(), manager.pre_fs_size.take())
        };

        if let Some((x, y)) = prev_pos {
            let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        }
        if let Some((w, h)) = prev_size {
            let _ = win.set_size(tauri::PhysicalSize::new(w, h));
        }

        std::thread::sleep(std::time::Duration::from_millis(50));
        if let Ok(size) = win.inner_size() {
            let manager = state.lock().map_err(|e| e.to_string())?;
            let w = size.width as f64;
            let h = size.height as f64;
            let vh = if h > BARRA_ALTURA {
                h - BARRA_ALTURA
            } else {
                0.0
            };
            for (id, _) in manager.tabs.iter() {
                if let Some(wv) = win.get_webview(id) {
                    let _ = wv.set_bounds(tauri::Rect {
                        position: tauri::Position::Logical(tauri::LogicalPosition {
                            x: 0.0,
                            y: BARRA_ALTURA,
                        }),
                        size: tauri::Size::Logical(tauri::LogicalSize {
                            width: w,
                            height: vh,
                        }),
                    });
                }
            }
        }

        let _ = app.emit_to("main", "fullscreen-change", false);
    }

    Ok(())
}

#[tauri::command]
fn get_active_tab(state: tauri::State<TabState>) -> Option<String> {
    let manager = state.lock().unwrap();
    manager.active_tab.clone()
}

#[tauri::command]
fn hide_active_tab(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let _ = webview.hide();
        }
    }
}

#[tauri::command]
fn show_active_tab(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let manager = state.lock().unwrap();
    if let Some(ref active) = manager.active_tab {
        if let Some(webview) = app.get_webview(active) {
            let _ = webview.show();
        }
    }
}

// --- CONTROLES DE VENTANA ---

#[tauri::command]
fn close_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
fn minimize_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
fn maximize_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        if let Ok(is_maximized) = window.is_maximized() {
            if is_maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
        }
    }
}

// --- PUNTO DE ENTRADA ---

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
            get_active_tab,
            set_fullscreen,
            hide_active_tab,
            show_active_tab,
            close_window,
            minimize_window,
            maximize_window
        ])
        .setup(|_app| {
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(size) = event {
                if window.label() == "main" {
                    let tab_state: TabState = window.state::<TabState>().inner().clone();
                    let manager = tab_state.lock().unwrap();
                    let is_full = manager.is_fullscreen;

                    for (id, _) in manager.tabs.iter() {
                        if let Some(webview) = window.get_webview(id) {
                            let width = size.width as f64;
                            let height = size.height as f64;

                            let top_offset = if is_full { 0.0 } else { BARRA_ALTURA };
                            let view_height = if height > top_offset {
                                height - top_offset
                            } else {
                                0.0
                            };

                            let _ = webview.set_bounds(tauri::Rect {
                                position: tauri::Position::Logical(tauri::LogicalPosition {
                                    x: 0.0,
                                    y: top_offset,
                                }),
                                size: tauri::Size::Logical(tauri::LogicalSize {
                                    width,
                                    height: view_height,
                                }),
                            });
                        }
                    }
                }
            }
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}