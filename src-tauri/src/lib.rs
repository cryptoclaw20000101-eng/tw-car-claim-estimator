// ============================================================
// Tauri v2 入口（v0.4.0）
// 對齊 v0.3.3 桌面小程式：把 public/claim-calculator.html 包成 .app
// ============================================================

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_app_name() -> String {
    "台灣車禍理賠估算器".to_string()
}

#[tauri::command]
fn get_app_metadata() -> serde_json::Value {
    serde_json::json!({
        "name": "台灣車禍理賠估算器",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "律師事務所桌面版 - 強制汽車責任保險法 + 民法侵權行為 + 6 直轄市地方法院實務區間",
        "precedentCount": 441,
        "functionCount": 8,
        "locale": "zh-TW",
        "author": "FlowTrace Labs"
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_app_name,
            get_app_metadata
        ])
        .setup(|_app| {
            // macOS：設定應用程式標題列
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.set_title("台灣車禍理賠估算器 v0.4.0");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("啟動 Tauri 應用失敗");
}
