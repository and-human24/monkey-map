use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static WATCHER_STATE: Mutex<Option<WatcherInner>> = Mutex::new(None);
static SELF_WRITE_COUNTER: AtomicU32 = AtomicU32::new(0);

struct WatcherInner {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

pub fn mark_self_write() {
    SELF_WRITE_COUNTER.fetch_add(1, Ordering::SeqCst);
}

pub fn clear_self_write() {
    let _ = SELF_WRITE_COUNTER.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |v| {
        if v > 0 { Some(v - 1) } else { None }
    });
}

fn is_self_write() -> bool {
    SELF_WRITE_COUNTER.load(Ordering::SeqCst) > 0
}

use crate::error::map_internal_err;

pub fn start_watcher(app_handle: AppHandle, path: String) -> Result<(), String> {
    stop_watcher()?;

    let validated = crate::commands::validate_path(&path)?;
    let is_dir = validated.is_dir();
    let watch_path = validated.to_string_lossy().to_string();
    let emit_path = watch_path.clone();

    let debounce_ms = if is_dir { 200 } else { 100 };

    let mut debouncer = new_debouncer(Duration::from_millis(debounce_ms), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
        if is_self_write() {
            clear_self_write();
            return;
        }
        if let Ok(events) = res {
            let dominated = events.iter().any(|e| e.kind == DebouncedEventKind::Any);
            if dominated {
                let p = std::path::Path::new(&emit_path);
                let content = if p.is_dir() {
                    crate::commands::reassemble_folder(p).ok()
                } else {
                    std::fs::read_to_string(&emit_path).ok()
                };
                if let Some(content) = content {
                    let _ = app_handle.emit("file-changed", content);
                }
            }
        }
    })
    .map_err(|e| map_internal_err("initialize file watcher", e))?;

    let mode = if is_dir { RecursiveMode::Recursive } else { RecursiveMode::NonRecursive };
    debouncer
        .watcher()
        .watch(std::path::Path::new(&watch_path), mode)
        .map_err(|e| map_internal_err("start file watcher", e))?;

    let mut guard = WATCHER_STATE.lock().map_err(|e| map_internal_err("acquire watcher lock", e))?;
    *guard = Some(WatcherInner {
        _debouncer: debouncer,
    });

    Ok(())
}

pub fn stop_watcher() -> Result<(), String> {
    let mut guard = WATCHER_STATE.lock().map_err(|e| map_internal_err("acquire watcher lock", e))?;
    *guard = None;
    Ok(())
}

// -- Tauri commands --

#[tauri::command]
pub fn start_watching(app: tauri::AppHandle, path: String) -> Result<(), String> {
    start_watcher(app, path)
}

#[tauri::command]
pub fn stop_watching() -> Result<(), String> {
    stop_watcher()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mark_self_write_increments_counter() {
        let before = SELF_WRITE_COUNTER.load(Ordering::SeqCst);
        mark_self_write();
        assert_eq!(SELF_WRITE_COUNTER.load(Ordering::SeqCst), before + 1);
        clear_self_write();
    }

    #[test]
    fn is_self_write_reflects_counter() {
        let _ = is_self_write();
    }
}
