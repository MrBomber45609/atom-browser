use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewUrl};

// --- CONSTANTES ---
const BARRA_ALTURA: f64 = 72.0;

// --- SCRIPT DE SEGURIDAD (cargado desde archivo externo) ---
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

    // Preservar lógica original de home.html
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
            .on_download(move |webview, event| {
                match event {
                    tauri::webview::DownloadEvent::Requested { url, destination } => {
                        let filename = destination
                            .file_name()
                            .map(|f| f.to_string_lossy().to_string())
                            .unwrap_or_default();
                        // Broadcast globally so Popup and Main window both get it
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
                }
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

// --- PUNTO DE ENTRADA ---

#[tauri::command]
fn toggle_popup(app: tauri::AppHandle, show: bool) {
    if let Some(window) = app.get_webview_window("popup") {
        if show {
            // Hardcoded position/size specific to "Download" button for now,
            // or we could pass x,y relative to monitor.
            // For simplicity in V1, let's just show it. Ideally frontend passes logic.
            // But main window is decoration-less, so (0,0) is screen (0,0) IF maximized?
            // Actually, we'll let frontend calculate position if possible,
            // but for "Z-Order fix", just showing it on top is the key.
            // Let's rely on standard positioning if provided, or default.
            // Wait, command signature in plan was (show, x, y, width, height).
            // Let's stick to simple "show/hide" first, and let the window keep its defined size.
            // Positioning relative to parent is tricky without client logic.
            // REVISION: Let's accept position args.
            window.show().unwrap();
            window.set_focus().unwrap();
        } else {
            window.hide().unwrap();
        }
    }
}

#[tauri::command]
fn content_position(app: tauri::AppHandle, x: f64, y: f64) {
    // x, y ahora son relativos al viewport de la ventana 'main'
    if let Some(popup) = app.get_webview_window("popup") {
        if let Some(main) = app.get_webview_window("main") {
            if let Ok(main_pos) = main.inner_position() {
                // Usamos inner_position para obtener la esquina superior izquierda del área de contenido (ignorando barra título)
                // Nota: PhysicalPosition -> LogicalPosition conversion might be needed implicity or explicitly?
                // inner_position devuelve PhysicalPosition (pixeles reales).
                // set_position espera Position enum.

                // Como las coords de JS (getBoundingClientRect) vienen en pixels lógicos (CSS pixels),
                // y inner_position está en físicos, necesitamos el scale factor.
                let scale_factor = main.scale_factor().unwrap_or(1.0);

                let main_logical_x = main_pos.x as f64 / scale_factor;
                let main_logical_y = main_pos.y as f64 / scale_factor;

                let final_x = main_logical_x + x;
                let final_y = main_logical_y + y;

                let _ = popup.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                    x: final_x,
                    y: final_y,
                }));
            }
        }
    }
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
            get_active_tab,
            toggle_popup,
            content_position
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(size) = event {
                if window.label() == "main" {
                    let tab_state: TabState = window.state::<TabState>().inner().clone();

                    {
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
            }
        })
        .setup(move |_app| Ok(()))
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
