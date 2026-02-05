use tauri::{Manager, WebviewUrl, Emitter};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::Serialize;

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

// --- COMANDOS ---

#[tauri::command]
async fn create_tab(app: tauri::AppHandle, state: tauri::State<'_, TabState>, url: Option<String>) -> Result<String, String> {
    println!("Creating tab...");

    // 1. PRIMER LOCK: Solo para calcular ID y ver cual ocultar
    let (tab_id, old_active, initial_url) = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        let id = manager.new_id();
        let old = manager.active_tab.clone();
        let url_str = url.unwrap_or_else(|| "about:blank".to_string());
        (id, old, url_str)
    }; 
    // ¡LOCK LIBERADO!

    // 2. Operaciones de UI (Ocultar anterior)
    if let Some(old_id) = old_active {
        if let Some(webview) = app.get_webview(&old_id) {
            let _ = webview.hide();
        }
    }

    // 3. Crear el nuevo Webview
    let win = app.get_window("main").ok_or("No se encontró la ventana 'main'")?;
    let handle = app.clone();
    let tab_id_clone = tab_id.clone();
    let parsed_url = initial_url.parse().unwrap_or("about:blank".parse().unwrap());
    
    let barra_altura = 38.0;
    let size = win.inner_size().map_err(|e| e.to_string())?;

    println!("Añadiendo webview...");
    
    win.add_child(
        tauri::webview::WebviewBuilder::new(
            &tab_id,
            WebviewUrl::External(parsed_url)
        )
        .auto_resize()
        .on_page_load(move |webview, _payload| {
            if let Ok(url) = webview.url() {
                let _ = handle.emit("url-changed", TabInfo { 
                    id: tab_id_clone.clone(), 
                    url: url.to_string() 
                });
            }
        }),
        tauri::LogicalPosition::new(0.0, barra_altura),
        tauri::LogicalSize::new(size.width as f64, size.height as f64 - barra_altura)
    ).map_err(|e| e.to_string())?;

    println!("Webview creado con éxito.");

    // 4. SEGUNDO LOCK: Guardar la nueva tab en el estado
    {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.tabs.insert(tab_id.clone(), initial_url);
        manager.active_tab = Some(tab_id.clone());
    }

    Ok(tab_id)
}

#[tauri::command]
fn close_tab(app: tauri::AppHandle, state: tauri::State<TabState>, tab_id: String) -> Result<(), String> {
    let new_active = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        
        if !manager.tabs.contains_key(&tab_id) { 
            return Err("Tab not found".to_string()); 
        }
        
        manager.tabs.remove(&tab_id);
        
        if manager.active_tab.as_ref() == Some(&tab_id) {
            manager.active_tab = manager.tabs.keys().next().cloned();
            manager.active_tab.clone()
        } else {
            None
        }
    };
    
    if let Some(webview) = app.get_webview(&tab_id) {
        let _ = webview.close();
    }
    
    if let Some(ref new_id) = new_active {
        if let Some(webview) = app.get_webview(new_id) {
            let _ = webview.show();
        }
    }
    
    Ok(())
}

#[tauri::command]
fn switch_tab(app: tauri::AppHandle, state: tauri::State<TabState>, tab_id: String) -> Result<(), String> {
    let old_active = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        if !manager.tabs.contains_key(&tab_id) { 
            return Err("Tab no encontrada".to_string()); 
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
    let active = {
        let manager = state.lock().unwrap();
        manager.active_tab.clone()
    };
    
    if let Some(ref tab_id) = active {
        if let Some(webview) = app.get_webview(tab_id) {
            if let Ok(parsed_url) = url.parse() {
                let _ = webview.navigate(parsed_url);
            }
        }
    }
}

#[tauri::command]
fn go_back(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let active = {
        let manager = state.lock().unwrap();
        manager.active_tab.clone()
    };
    
    if let Some(ref tab_id) = active {
        if let Some(webview) = app.get_webview(tab_id) {
            let _ = webview.eval("window.history.back()");
        }
    }
}

#[tauri::command]
fn go_forward(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let active = {
        let manager = state.lock().unwrap();
        manager.active_tab.clone()
    };
    
    if let Some(ref tab_id) = active {
        if let Some(webview) = app.get_webview(tab_id) {
            let _ = webview.eval("window.history.forward()");
        }
    }
}

#[tauri::command]
fn reload(app: tauri::AppHandle, state: tauri::State<TabState>) {
    let active = {
        let manager = state.lock().unwrap();
        manager.active_tab.clone()
    };
    
    if let Some(ref tab_id) = active {
        if let Some(webview) = app.get_webview(tab_id) {
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
            navigate, go_back, go_forward, reload,
            create_tab, close_tab, switch_tab, get_active_tab
        ])
        .setup(move |app| {
            let win = app.get_window("main").unwrap();
            
            // Crear pestaña inicial con lock corto
            let tab_id = {
                let mut manager = tab_state.lock().unwrap();
                let id = manager.new_id();
                manager.tabs.insert(id.clone(), "about:blank".to_string());
                manager.active_tab = Some(id.clone());
                id
            }; 
            
            let barra_altura = 38.0;
            let size = win.inner_size().unwrap();
            let handle = app.handle().clone();
            let tab_id_clone = tab_id.clone();

            let _ = win.add_child(
                tauri::webview::WebviewBuilder::new(
                    &tab_id,
                    WebviewUrl::External("about:blank".parse().unwrap())
                )
                .auto_resize()
                .on_page_load(move |webview, _payload| {
                    if let Ok(url) = webview.url() {
                        let _ = handle.emit("url-changed", TabInfo { 
                            id: tab_id_clone.clone(), 
                            url: url.to_string() 
                        });
                    }
                }),
                tauri::LogicalPosition::new(0.0, barra_altura),
                tauri::LogicalSize::new(size.width as f64, size.height as f64 - barra_altura)
            )?;

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}