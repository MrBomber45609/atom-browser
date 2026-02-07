use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewUrl};

// --- CONSTANTES ---
const BARRA_ALTURA: f64 = 72.0;

// --- SCRIPT DE SEGURIDAD ---
const ATOM_SHIELD_SCRIPT: &str = include_str!("../scripts/atom_shield.js");

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

// --- COMANDOS TAURI ---

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
    let handle = app.clone();
    let tab_id_clone = tab_id.clone();

    let stored_url = url.clone().unwrap_or_else(|| "atom://home".to_string());

    let webview_url = match url {
        Some(u) if !u.is_empty() => {
            let parsed = u.parse().unwrap_or_else(|_| "about:blank".parse().unwrap());
            WebviewUrl::External(parsed)
        }
        _ => WebviewUrl::App("home.html".into()),
    };

    let size = win.inner_size().map_err(|e| e.to_string())?;

    win.add_child(
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
            .on_page_load(move |webview, _payload| {
                let _ = webview.eval(ATOM_SHIELD_SCRIPT);

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
        tauri::LogicalPosition::new(0.0, BARRA_ALTURA),
        tauri::LogicalSize::new(size.width as f64, size.height as f64 - BARRA_ALTURA),
    )
    .map_err(|e| e.to_string())?;

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

// --- CONTROLES DE VENTANA (BACKEND) ---

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
            close_window,
            minimize_window,
            maximize_window
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(size) = event {
                if window.label() == "main" {
                    let tab_state: TabState = window.state::<TabState>().inner().clone();
                    let manager = tab_state.lock().unwrap();
                    for (id, _) in manager.tabs.iter() {
                        if let Some(webview) = window.get_webview(id) {
                            let width = size.width as f64;
                            let height = size.height as f64;
                            let _ = webview.set_bounds(tauri::Rect {
                                position: tauri::Position::Logical(tauri::LogicalPosition {
                                    x: 0.0,
                                    y: BARRA_ALTURA,
                                }),
                                size: tauri::Size::Logical(tauri::LogicalSize {
                                    width,
                                    height: if height > BARRA_ALTURA {
                                        height - BARRA_ALTURA
                                    } else {
                                        0.0
                                    },
                                }),
                            });
                        }
                    }
                }
            }
        })
        .setup(move |_app| Ok(()))
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
