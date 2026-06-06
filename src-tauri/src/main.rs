// src/main.rs
//
// Prevents a console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nidhibook_desktop_lib::run();
}
