use base64::{engine::general_purpose, Engine as _};
use std::fs;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn save_pfx_dialog(
    app: tauri::AppHandle,
    suggested_name: String,
    content: String,
    filter_name: String,
    extensions: Vec<String>,
) -> Result<bool, String> {
    let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&suggested_name)
        .add_filter(&filter_name, &ext_refs)
        .blocking_save_file();

    if let Some(path) = file_path {
        let p = path.into_path().map_err(|e| e.to_string())?;
        fs::write(p, content.as_bytes()).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn save_image_dialog(
    app: tauri::AppHandle,
    suggested_name: String,
    base64_data: String,
    extensions: Vec<String>,
) -> Result<bool, String> {
    let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&suggested_name)
        .add_filter("Image File", &ext_refs)
        .blocking_save_file();

    if let Some(path) = file_path {
        let bytes = general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| e.to_string())?;
        let p = path.into_path().map_err(|e| e.to_string())?;
        fs::write(p, &bytes).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_pfx_dialog, save_image_dialog])
        .run(tauri::generate_context!())
        .expect("error while running PixelLab Desktop");
}
