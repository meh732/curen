#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{image::Image, Manager};

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

fn get_all_candidate_lock_paths() -> Vec<PathBuf> {
  let mut paths = Vec::new();

  #[cfg(target_os = "windows")]
  {
    // 1. ProgramData (System-wide, completely preserved across app updates, installs, and uninstalls)
    if let Ok(prog_data) = std::env::var("ProgramData") {
      let dir = PathBuf::from(&prog_data).join("ARKA_Accounting");
      let _ = fs::create_dir_all(&dir);
      paths.push(dir.join("arka_master_license_v6.lock"));
    } else {
      let dir = PathBuf::from(r"C:\ProgramData\ARKA_Accounting");
      let _ = fs::create_dir_all(&dir);
      paths.push(dir.join("arka_master_license_v6.lock"));
    }

    // 2. LocalAppData directories (current and legacy app identifiers)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      let base = PathBuf::from(&local_app_data);
      let candidate_dirs = [
        base.join("com.arka.accounting"),
        base.join("ARKA_Accounting"),
        base.join("com.tarazban.accounting"),
        base.join("TarazBan_Accounting"),
      ];
      for dir in candidate_dirs.iter() {
        let _ = fs::create_dir_all(dir);
        paths.push(dir.join("arka_master_license_v6.lock"));
      }
    }

    // 3. Roaming AppData
    if let Ok(app_data) = std::env::var("APPDATA") {
      let dir = PathBuf::from(&app_data).join("ARKA_Accounting");
      let _ = fs::create_dir_all(&dir);
      paths.push(dir.join("arka_master_license_v6.lock"));
    }
  }

  // 4. Executable parent directory
  if let Ok(exe_path) = std::env::current_exe() {
    if let Some(parent) = exe_path.parent() {
      paths.push(parent.join("arka_master_license_v6.lock"));
    }
  }

  paths.push(PathBuf::from("arka_master_license_v6.lock"));
  paths
}

fn resolve_license_lock_path() -> PathBuf {
  let candidates = get_all_candidate_lock_paths();
  for p in &candidates {
    if p.exists() {
      return p.clone();
    }
  }
  candidates.first().cloned().unwrap_or_else(|| PathBuf::from("arka_master_license_v6.lock"))
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

#[tauri::command]
fn verify_native_license_lock(machine_id: String, seal: String) -> bool {
  let clean_machine = machine_id.trim().to_uppercase();
  let clean_seal = seal.trim().to_uppercase();
  let expected_prefix = format!("ARKA_V6_LOCK::{}::{}", clean_machine, clean_seal);

  let paths = get_all_candidate_lock_paths();
  for path in &paths {
    if path.exists() {
      if let Ok(content) = fs::read_to_string(path) {
        let trimmed = content.trim();
        if trimmed == expected_prefix || trimmed.starts_with(&expected_prefix) {
          // Sync valid lock to ALL other candidate paths
          for target in &paths {
            if target != path {
              if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
              }
              let _ = fs::write(target, trimmed);
            }
          }
          return true;
        }
      }
    }
  }
  false
}

#[tauri::command]
fn get_saved_native_license(machine_id: String) -> Option<String> {
  let clean_machine = machine_id.trim().to_uppercase();
  let prefix = format!("ARKA_V6_LOCK::{}::", clean_machine);

  let paths = get_all_candidate_lock_paths();
  for path in &paths {
    if path.exists() {
      if let Ok(content) = fs::read_to_string(path) {
        let trimmed = content.trim();
        if trimmed.starts_with(&prefix) {
          // Sync found lock to all other candidate locations
          for target in &paths {
            if target != path {
              if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
              }
              let _ = fs::write(target, trimmed);
            }
          }
          return Some(trimmed.to_string());
        }
      }
    }
  }
  None
}

#[tauri::command]
fn save_native_license_lock(machine_id: String, seal: String, activation_key: Option<String>) -> bool {
  let key_str = activation_key.unwrap_or_default();
  let payload = format!(
    "ARKA_V6_LOCK::{}::{}::{}",
    machine_id.trim().to_uppercase(),
    seal.trim().to_uppercase(),
    key_str.trim().to_uppercase()
  );

  let mut any_success = false;
  let paths = get_all_candidate_lock_paths();
  for path in &paths {
    if let Some(parent) = path.parent() {
      let _ = fs::create_dir_all(parent);
    }
    if fs::write(path, &payload).is_ok() {
      any_success = true;
    }
  }
  any_success
}

#[tauri::command]
fn revoke_native_license_lock() -> bool {
  let paths = get_all_candidate_lock_paths();
  for path in &paths {
    if path.exists() {
      let _ = fs::remove_file(path);
    }
  }
  true
}

fn purge_stale_webview_cache_on_upgrade() {
  #[cfg(target_os = "windows")]
  {
    const CURRENT_BUILD_STAMP: &str = "ARKA-6.0.0";
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      let base = PathBuf::from(&local_app_data);
      let candidate_roots = [
        base.join("com.arka.accounting"),
        base.join("ARKA_Accounting"),
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
          // Purge only cached assets and Service Workers; keep Local Storage accounting data intact!
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
          // Remove any legacy pre-V6 license files so V6 Master Password activation is strictly enforced
          let old_locks = [
            root.join("tarazban_license.dat"),
            root.join("arka_license_v5.lock"),
          ];
          for f in old_locks.iter() {
            if f.exists() {
              let _ = fs::remove_file(f);
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
    .setup(|app| {
      if let Ok(icon) = Image::from_bytes(include_bytes!("../icons/icon.png")) {
        for (_, window) in app.webview_windows() {
          let _ = window.set_icon(icon.clone());
        }
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.set_icon(icon);
        }
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_backup_folder_path,
      save_auto_backup,
      read_latest_auto_backup,
      verify_native_license_lock,
      get_saved_native_license,
      save_native_license_lock,
      revoke_native_license_lock
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
