#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

fn main() {
    let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut("Ctrl+Shift+Space")
        .expect("invalid global shortcut")
        .with_handler(|app, _shortcut, _event| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(global_shortcut_plugin)
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let _ = app.global_shortcut();
            let show_item = MenuItemBuilder::new("Show").id("show").build(app)?;
            let hide_item = MenuItemBuilder::new("Hide").id("hide").build(app)?;
            let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .item(&quit_item)
                .build()?;

            let app_handle = app.handle().clone();
            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(move |_, event| {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        match event.id().as_ref() {
                            "show" => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            "hide" => {
                                let _ = window.hide();
                            }
                            "quit" => {
                                app_handle.exit(0);
                            }
                            _ => {}
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
