#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn resolve_backup_dir() -> PathBuf {
  #[cfg(target_os = "windows")]
  {
    let win_dir = PathBuf::from(r"C:\TarazBan_Backups");
    if fs::create_dir_all(&win_dir).is_ok() {
      return win_dir;
    }
  }
  if let Ok(exe_path) = std::env::current_exe() {
    if let Some(parent) = exe_path.parent() {
      let dir = parent.join("backups");
      let _ = fs::create_dir_all(&dir);
      return dir;
    }
  }
  let fallback = PathBuf::from("backups");
  let _ = fs::create_dir_all(&fallback);
  fallback
}

#[tauri::command]
fn get_backup_folder_path() -> String {
  resolve_backup_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn save_auto_backup(json_content: String, reason: String) -> Result<String, String> {
  let dir = resolve_backup_dir();
  let latest_path = dir.join("TarazBan_Latest_AutoBackup.json");
  fs::write(&latest_path, &json_content).map_err(|e| e.to_string())?;

  let ts = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  let safe_reason: String = reason
    .chars()
    .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
    .collect();
  let snap_name = format!(
    "TarazBan_AutoBackup_{}_{}.json",
    ts,
    if safe_reason.is_empty() { "auto" } else { &safe_reason }
  );
  let snap_path = dir.join(snap_name);
  let _ = fs::write(&snap_path, &json_content);

  Ok(latest_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_latest_auto_backup() -> Result<String, String> {
  let dir = resolve_backup_dir();
  let latest_path = dir.join("TarazBan_Latest_AutoBackup.json");
  fs::read_to_string(&latest_path).map_err(|e| e.to_string())
}

fn purge_stale_webview_cache_on_upgrade() {
  #[cfg(target_os = "windows")]
  {
    const CURRENT_BUILD_STAMP: &str = "ARKA-5.5.0";
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      let base = PathBuf::from(&local_app_data);
      let candidate_roots = [
        base.join("com.tarazban.accounting"),
        base.join("TarazBan_Accounting"),
      ];
      for root in candidate_roots.iter() {
        if !root.exists() {
          continue;
        }
        let stamp_file = root.join(".arka_webview_version");
        let existing_stamp = fs::read_to_string(&stamp_file).unwrap_or_default();
        if existing_stamp.trim() != CURRENT_BUILD_STAMP {
          let eb_default = root.join("EBWebView").join("Default");
          // Purge only cached assets and Service Workers; NEVER touch Local Storage or IndexedDB!
          let cache_dirs = [
            eb_default.join("Service Worker"),
            eb_default.join("Cache"),
            eb_default.join("Code Cache"),
            eb_default.join("GPUCache"),
            eb_default.join("DawnCache"),
          ];
          for dir in cache_dirs.iter() {
            if dir.exists() {
              let _ = fs::remove_dir_all(dir);
            }
          }
          let _ = fs::write(&stamp_file, CURRENT_BUILD_STAMP);
        }
      }
    }
  }
}

fn main() {
  purge_stale_webview_cache_on_upgrade();

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      get_backup_folder_path,
      save_auto_backup,
      read_latest_auto_backup
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
