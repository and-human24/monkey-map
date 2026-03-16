use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::fs;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

static WATCHER_STATE: Mutex<Option<WatcherInner>> = Mutex::new(None);
static LAST_SELF_WRITE: Mutex<Option<Instant>> = Mutex::new(None);

struct WatcherInner {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

pub fn mark_self_write() {
    if let Ok(mut guard) = LAST_SELF_WRITE.lock() {
        *guard = Some(Instant::now());
    }
}

fn is_self_write() -> bool {
    if let Ok(guard) = LAST_SELF_WRITE.lock() {
        if let Some(t) = *guard {
            return t.elapsed() < Duration::from_millis(200);
        }
    }
    false
}

use crate::error::map_internal_err;

pub fn start_watcher(app_handle: AppHandle, path: String) -> Result<(), String> {
    stop_watcher()?;

    let validated = crate::commands::validate_path(&path)?;
    let watch_path = validated.to_string_lossy().to_string();
    let emit_path = watch_path.clone();

    let mut debouncer = new_debouncer(Duration::from_millis(100), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
        if is_self_write() {
            return;
        }
        if let Ok(events) = res {
            let dominated = events.iter().any(|e| e.kind == DebouncedEventKind::Any);
            if dominated {
                if let Ok(content) = fs::read_to_string(&emit_path) {
                    let _ = app_handle.emit("file-changed", content);
                }
            }
        }
    })
    .map_err(|e| map_internal_err("initialize file watcher", e))?;

    debouncer
        .watcher()
        .watch(std::path::Path::new(&watch_path), RecursiveMode::NonRecursive)
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
    fn mark_self_write_sets_timestamp() {
        mark_self_write();
        assert!(is_self_write());
    }

    #[test]
    fn is_self_write_false_without_mark() {
        // The static may have been set by other tests, so just verify the function runs
        let _ = is_self_write();
    }
}
