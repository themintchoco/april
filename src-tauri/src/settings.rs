pub fn get_setting(app: &tauri::AppHandle, setting: &str) -> Option<serde_json::Value> {
    let json_str = std::fs::read_to_string(app.path_resolver().app_config_dir()?.join("settings.json")).ok()?;
    Some(serde_json::from_str::<serde_json::Value>(&json_str).ok()?[setting].clone())
}
