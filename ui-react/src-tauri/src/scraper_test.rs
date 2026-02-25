use tauri::{AppHandle, Manager};

pub fn test_builder(app: &AppHandle) {
    let _ = tauri::WebviewWindowBuilder::new(
        app,
        "test",
        tauri::WebviewUrl::App("index.html".into())
    )
    .inner_size(100.0, 100.0)
    .position(-10000.0, -10000.0)
    .decorations(false)
    .transparent(true)
    .visible(true)
    .build();
}
