use std::process::Command;

#[tauri::command]
pub fn open_app(file: Option<String>, app_name: Option<String>) -> Result<(i32, String, String), String> {
    #[cfg(not(target_os = "macos"))]
    todo!();

    let args = match (file, app_name) {
        (Some(file), Some(app)) => vec![file, "-a".into(), app],
        (Some(file), None) => vec![file],
        (None, Some(app)) => vec!["-a".into(), app],
        (None, None) => return Ok((1, "".into(), "Specify a file or app".into())),
    };

    Command::new("open")
        .args(args)
        .output()
        .map_err(|error| error.to_string())
        .and_then(|output| {
            let exit_code = output.status.code().unwrap_or_default();
            let stdout = String::from_utf8(output.stdout).unwrap_or_default();
            let stderr = String::from_utf8(output.stderr).unwrap_or_default();

            Ok((exit_code, stdout, stderr))
        })
}
