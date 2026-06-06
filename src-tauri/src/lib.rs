// src/lib.rs
//
// Application library crate.
// All Tauri setup lives here; main.rs simply calls run().
//
// Add custom Tauri commands here using #[tauri::command] if you need
// to expose native Rust functionality to the frontend.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register the SQL plugin — enables @tauri-apps/plugin-sql in the frontend
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
