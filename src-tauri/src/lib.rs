mod ai_supplement;
mod terminal_prefill;

use ai_supplement::{
  generate_ai_supplement, get_ai_provider_store, get_ai_runtime_status,
  save_ai_provider_store, test_ai_provider_connection,
};
use terminal_prefill::{
  create_tracker, get_terminal_prefill_status, prefill_terminal_input, start_tracking,
  TerminalTracker,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let terminal_tracker: TerminalTracker = create_tracker();

  tauri::Builder::default()
    .manage(terminal_tracker.clone())
    .setup(move |app| {
      let _ = dotenvy::dotenv();

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      start_tracking(terminal_tracker.clone());

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      prefill_terminal_input,
      get_terminal_prefill_status,
      get_ai_provider_store,
      save_ai_provider_store,
      test_ai_provider_connection,
      get_ai_runtime_status,
      generate_ai_supplement
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
