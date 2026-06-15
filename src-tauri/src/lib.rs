// ============================================================
// Tauri v2 入口（v0.4.3-5）
// - 原生選單（macOS 標準，11 個 menu item）
// - 快捷鍵（Cmd+N/S/E/O/R/W/Q 全綁）
// - native file dialog（取代 jsPDF）
// - native notification
// ============================================================

use serde::Serialize;
use tauri::menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, WebviewWindow};

// === Tauri commands（從 HTML 內 invoke 用）===

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_app_metadata() -> serde_json::Value {
    serde_json::json!({
        "name": "台灣車禍理賠估算器",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "理賠顧問桌面版 - 強制汽車責任保險法 + 民法侵權行為 + 6 直轄市地方法院實務區間",
        "precedentCount": 441,
        "functionCount": 8,
        "locale": "zh-TW",
        "author": "FlowTrace Labs"
    })
}

/// 試算完成通知（HTML 端 calcAll 跑完後 invoke）
#[tauri::command]
async fn notify_estimation_complete(
    app: AppHandle,
    window: WebviewWindow,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    let _ = window;  // 保留以便未來擴充

    NotificationExt::notification(&app)
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// HTML 端 saveToHistory() 跑完後 invoke 通知
#[tauri::command]
async fn notify_saved(
    app: AppHandle,
    count: usize,
    max: usize,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    NotificationExt::notification(&app)
        .builder()
        .title("已存到歷史")
        .body(format!("目前 {}/{} 件", count, max))
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 用 native dialog 存 PDF 內容（HTML 端把 PDF bytes 傳進來）
#[derive(Serialize)]
struct SavePdfResult {
    path: String,
    bytes: usize,
}

#[tauri::command]
async fn save_pdf_with_dialog(
    app: AppHandle,
    default_name: String,
    pdf_base64: String,
) -> Result<Option<SavePdfResult>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = rx.recv().map_err(|e| e.to_string())?;
    match file_path {
        Some(p) => {
            let path_str = p.to_string();
            // 寫檔（base64 decode → bytes）
            use base64_decode::decode_base64;  // 內建 helper
            let bytes = decode_base64(&pdf_base64);
            std::fs::write(&path_str, &bytes).map_err(|e| e.to_string())?;
            Ok(Some(SavePdfResult {
                path: path_str,
                bytes: bytes.len(),
            }))
        }
        None => Ok(None),  // 用戶取消
    }
}

// === 選單事件處理（從 Rust 觸發 HTML 內 JS）===

fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().0.as_str();
    let window = app.get_webview_window("main");

    // 對應 HTML 內全域函式（v0.3.3 已定義）
    // 用 webview.eval 觸發 JS
    let js_call = match id {
        "new_case" => Some("if (typeof clearAllForm === 'function') { clearAllForm(); } else { goStep(1); }"),
        "open_history" => Some("document.getElementById('historySelect')?.focus()"),
        "save_to_history" => Some("if (typeof saveToHistory === 'function') saveToHistory();"),
        "export_pdf" => Some("if (typeof exportPDF === 'function') exportPDF();"),
        "show_about" => Some("alert('台灣車禍理賠估算器 v0.4.5\\n理賠顧問桌面版\\n\\n依強制汽車責任保險法、民法 §184-196 估算\\n8 個計算函式 / 441 件真實判例\\n設計：信任藍 #003D7A + 橘紅 #F26522 + 思源黑體\\n\\n© 2026 FlowTrace Labs');"),
        _ => None,
    };

    if let Some(js) = js_call {
        if let Some(win) = window {
            let _ = win.eval(js);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_app_metadata,
            notify_estimation_complete,
            notify_saved,
            save_pdf_with_dialog
        ])
        .setup(|app| {
            // === 1. 設定視窗標題（macOS 標題列）===
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("台灣車禍理賠估算器 v0.4.3");
            }

            // === 2. 建原生選單（macOS 標準 5 個子選單）===
            let about_meta = AboutMetadata {
                name: Some("台灣車禍理賠估算器".to_string()),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
                short_version: None,
                authors: Some(vec!["FlowTrace Labs".to_string()]),
                comments: Some("理賠顧問桌面版".to_string()),
                copyright: Some("© 2026 FlowTrace Labs".to_string()),
                license: Some("MIT".to_string()),
                website: None,
                website_label: None,
                credits: None,
                icon: None,
            };

            // App 選單（macOS 第一個）
            let app_submenu = Submenu::with_items(
                app,
                "台灣車禍理賠估算器",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("關於台灣車禍理賠估算器"), Some(about_meta))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            // 檔案選單
            let file_submenu = Submenu::with_items(
                app,
                "檔案",
                true,
                &[
                    &MenuItem::with_id(app, "new_case", "新案件", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "open_history", "開啟歷史", true, Some("CmdOrCtrl+O"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "save_to_history", "存到歷史", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(app, "export_pdf", "匯出 PDF", true, Some("CmdOrCtrl+E"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            // 編輯選單
            let edit_submenu = Submenu::with_items(
                app,
                "編輯",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            // 檢視選單
            let view_submenu = Submenu::with_items(
                app,
                "檢視",
                true,
                &[
                    &PredefinedMenuItem::fullscreen(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "show_about", "關於本軟體", true, None::<&str>)?,
                ],
            )?;

            // 視窗選單
            let window_submenu = Submenu::with_items(
                app,
                "視窗",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[&app_submenu, &file_submenu, &edit_submenu, &view_submenu, &window_submenu],
            )?;

            app.set_menu(menu)?;

            // === 3. 處理選單事件 ===
            app.on_menu_event(|app, event| {
                handle_menu_event(app, event);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("啟動 Tauri 應用失敗");
}

// === Helper: base64 decode（內建，不引外部 crate）===
mod base64_decode {
    pub fn decode_base64(s: &str) -> Vec<u8> {
        // 簡單 base64 decode（支援 jsPDF 輸出）
        let chars: Vec<u8> = s.bytes()
            .filter(|b| !b.is_ascii_whitespace())
            .collect();
        let mut out = Vec::with_capacity(chars.len() * 3 / 4);
        let mut buf: u32 = 0;
        let mut bits: u32 = 0;
        for &c in &chars {
            let v = match c {
                b'A'..=b'Z' => c - b'A',
                b'a'..=b'z' => c - b'a' + 26,
                b'0'..=b'9' => c - b'0' + 52,
                b'+' => 62,
                b'/' => 63,
                _ => continue,
            };
            buf = (buf << 6) | v as u32;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push((buf >> bits) as u8 & 0xFF);
            }
        }
        out
    }
}
