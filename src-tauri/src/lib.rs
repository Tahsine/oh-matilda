// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Clé Ollama Cloud lue côté Rust (jamais hardcodée en JS).
// - Runtime : `OLLAMA_API_KEY` dans l'env du process backend (desktop).
// - Compile-time : `option_env!` pour Android (binaire compilé sur PC,
//   le process sur device ne voit pas l'env du PC).
#[tauri::command]
fn get_ollama_key() -> Result<String, String> {
    if let Ok(k) = std::env::var("OLLAMA_API_KEY") {
        if !k.trim().is_empty() {
            return Ok(k);
        }
    }
    if let Some(k) = std::option_env!("OLLAMA_API_KEY") {
        if !k.trim().is_empty() {
            return Ok(k.to_string());
        }
    }
    Err("OLLAMA_API_KEY missing: export OLLAMA_API_KEY=... avant `tauri android dev` / `android build`".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_ollama_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
