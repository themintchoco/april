// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod settings;
mod commands;

use tauri::Manager;
use tauri_plugin_positioner::{WindowExt, Position};
use window_shadows::set_shadow;

#[cfg(target_os = "macos")]
use icrate::AppKit::NSApplication;

fn get_max_height_for_window(window: &tauri::Window) -> f64 {
    let height = window.current_monitor().map_or(0.0, |monitor| {
        monitor.map_or(0.0, |monitor| {
            monitor.size().to_logical(monitor.scale_factor()).height
        })
    });

    #[cfg(target_os = "macos")]
    unsafe {
        let ns_menu_height = NSApplication::sharedApplication().mainMenu().map_or(0.0, |menu_bar| menu_bar.menuBarHeight());
        height - ns_menu_height
    }

    #[cfg(not(target_os = "macos"))]
    height
}

#[tauri::command]
fn set_height(window: tauri::Window, height: f64) -> f64 {
    let max_height = get_max_height_for_window(&window);
    let clamped_height = match height {
        height if height > max_height => max_height,
        height if height == -1.0 => max_height,
        height if height < 0.0 => 0.0,
        height => height,
    };

    window.inner_size().map(|size| {
        window.set_size(tauri::LogicalSize { width: size.to_logical(window.scale_factor().unwrap()).width, height: clamped_height }).ok();
    }).ok();

    clamped_height
}

fn main() {
    unsafe { 
        commands::reminders::init_event_store();
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(|app| {
            app.get_window("main").map(|window| {
                window.move_window(Position::TopRight).ok();
                window.set_size(tauri::LogicalSize { width: 400, height: 0 }).ok();
                set_shadow(&window, false).ok();
            });

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            Ok(())
        })
        .system_tray(
            tauri::SystemTray::new().with_menu(tauri::SystemTrayMenu::new()
                .add_item(tauri::CustomMenuItem::new("settings", "Settings").accelerator("CommandOrControl+,"))
                .add_native_item(tauri::SystemTrayMenuItem::Separator)
                .add_item(tauri::CustomMenuItem::new("quit", "Quit").accelerator("Command+Q"))
            )
        )
        .on_system_tray_event(|app, event| {
            match event {
                tauri::SystemTrayEvent::LeftClick { .. } => {
                    app.get_window("main").map(|window| {
                        let height = window.inner_size().map_or(0, |size| size.to_logical(window.scale_factor().unwrap()).height).max(190);
                        window.set_size(tauri::LogicalSize { width: 400, height }).ok();
                        window.move_window(Position::TopRight).ok();

                        window.emit("showApril", {})
                            .expect("failed to emit showApril event");
                    });
                }
                tauri::SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                    "settings" => {
                        let _ = app.get_window("settings")
                            .map_or_else(|| {
                                let builder = tauri::WindowBuilder::new(app, "settings", tauri::WindowUrl::App("settings.html".into()))
                                    .title("Settings")
                                    .accept_first_mouse(true)
                                    .min_inner_size(430.0, 500.0)
                                    .center();
                                
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = builder
                                        .hidden_title(true)
                                        .title_bar_style(tauri::TitleBarStyle::Overlay)
                                        .build();
                                }

                                #[cfg(not(target_os = "macos"))]
                                let _ = builder.build();

                                Ok(())
                            }, |window| window.set_focus());
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                },
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_height,
            commands::python::init_venv,
            commands::python::python_run,
            commands::python::python_pip,
            commands::files::open_app,
            commands::reminders::get_lists,
            commands::reminders::get_enabled_lists,
            commands::reminders::get_reminders,
            commands::reminders::add_to_list,
            commands::reminders::delete_reminder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
