use std::{process::Command, fs::{remove_dir_all}};

pub fn get_python_interpreter(app: &tauri::AppHandle) -> Option<String> {
  let path = app.path_resolver().app_local_data_dir().unwrap().join("venv");

  if !path.is_dir() {
      return None;
  }

  #[cfg(any(target_os = "linux", target_os = "macos"))]
  {
      Some(path.join("bin").join("python3").into_os_string().into_string().unwrap())
  }

  #[cfg(target_os = "windows")]
  {
      Some(path.join("Scripts").join("python.exe").into_os_string().into_string().unwrap())
  }
}

#[tauri::command]
pub fn init_venv(app: tauri::AppHandle, interpreter: String) -> Result<(), String> {
    let version = match Command::new(&interpreter)
        .arg("-V")
        .output() {
            Ok(output) => String::from_utf8(output.stdout).unwrap_or_default(),
            Err(error) => return Err(error.to_string()),
        };
    
    match version_compare::compare_to(version, "Python 3.6", version_compare::Cmp::Ge) {
        Ok(true) => (),
        Ok(false) => return Err("Python 3.6 or higher is required".into()),
        Err(_) => return Err("Error ensuring Python version".into()),
    };

    let path = {
        let path = app.path_resolver().app_local_data_dir().unwrap().join("venv");

        if path.is_dir() {
            let _ = remove_dir_all(&path);
        }

        path.into_os_string().into_string().unwrap()
    };

    Command::new(&interpreter)
        .arg("-m")
        .arg("venv")
        .arg(path)
        .output()
        .map_err(|error| error.to_string())
        .and(Ok(()))
}

#[tauri::command]
pub fn python_run(app: tauri::AppHandle, code: String) -> Result<(i32, String, String), String> {
    let interpreter = match get_python_interpreter(&app) {
        Some(interpreter) => interpreter,
        None => return Err("Could not find Python interpreter".into()),
    };

    Command::new(&interpreter)
        .arg("-c")
        .arg(code)
        .output()
        .map_err(|error| error.to_string())
        .and_then(|output| {
            let exit_code = output.status.code().unwrap_or_default();
            let stdout = String::from_utf8(output.stdout).unwrap_or_default();
            let stderr = String::from_utf8(output.stderr).unwrap_or_default();

            Ok((exit_code, stdout, stderr))
        })
}

#[tauri::command]
pub fn python_pip(app: tauri::AppHandle, args_string: String) -> Result<(i32, String, String), String> {
    let args = shlex::split(&args_string).unwrap();

    let interpreter = match get_python_interpreter(&app) {
        Some(interpreter) => interpreter,
        None => return Err("Could not find Python interpreter".into()),
    };

    Command::new(&interpreter)
        .arg("-m")
        .arg("pip")
        .args(args)
        .arg("-qq")
        .output()
        .map_err(|error| error.to_string())
        .and_then(|output| {
            let exit_code = output.status.code().unwrap_or_default();
            let stdout = String::from_utf8(output.stdout).unwrap_or_default();
            let stderr = String::from_utf8(output.stderr).unwrap_or_default();

            Ok((exit_code, stdout, stderr))
        })
}
