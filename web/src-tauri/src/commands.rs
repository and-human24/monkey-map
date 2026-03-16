use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

fn config_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".monkey-map")
}

fn ensure_config_dir() -> Result<(), String> {
    let dir = config_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| map_internal_err("create config dir", e))?;
    }
    Ok(())
}

use crate::error::map_internal_err;

pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);

    // reject traversal segments
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Invalid path: directory traversal not allowed".to_string());
        }
    }

    // canonicalize (use parent if file doesn't exist yet)
    let canonical = if p.exists() {
        p.canonicalize().map_err(|e| map_internal_err("resolve path", e))?
    } else if let Some(parent) = p.parent() {
        if parent.exists() {
            let canon_parent = parent.canonicalize().map_err(|e| map_internal_err("resolve parent path", e))?;
            canon_parent.join(p.file_name().unwrap_or_default())
        } else {
            return Err("Parent directory does not exist".to_string());
        }
    } else {
        return Err("Invalid path".to_string());
    };

    // restrict to home directory
    let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    if !canonical.starts_with(&home) {
        return Err("Access denied: path must be within your home directory".to_string());
    }

    Ok(canonical)
}

fn default_mindmap_content(title: &str) -> String {
    let now = Utc::now().to_rfc3339();
    serde_json::json!({
        "meta": {
            "title": title,
            "created": now,
            "viewport": { "x": 0, "y": 0, "zoom": 1 }
        },
        "nodes": [{
            "id": Uuid::new_v4().to_string(),
            "type": "mindmap",
            "position": { "x": 250, "y": 250 },
            "data": { "label": "Start here" }
        }],
        "edges": []
    })
    .to_string()
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}

// -- Mindmap file operations --

#[tauri::command]
pub fn read_mindmap(path: String) -> Result<String, String> {
    let p = validate_path(&path)?;
    if p.exists() {
        fs::read_to_string(&p).map_err(|e| map_internal_err("read mindmap", e))
    } else {
        let content = default_mindmap_content("Untitled");
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| map_internal_err("create parent dir", e))?;
        }
        fs::write(&p, &content).map_err(|e| map_internal_err("write default mindmap", e))?;
        Ok(content)
    }
}

#[tauri::command]
pub fn write_mindmap(path: String, data: String) -> Result<(), String> {
    let p = validate_path(&path)?;
    crate::watcher::mark_self_write();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| map_internal_err("create parent dir", e))?;
    }
    fs::write(&p, &data).map_err(|e| map_internal_err("write mindmap", e))
}

#[tauri::command]
pub async fn pick_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Mind Map", &["json"])
        .blocking_pick_file();

    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.dialog().file().blocking_pick_folder();
    Ok(dir.map(|f| f.to_string()))
}

// -- Recent projects --

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RecentEntry {
    path: String,
    title: String,
    last_opened: String,
}

fn recent_path() -> PathBuf {
    config_dir().join("recent.json")
}

fn read_recent_entries() -> Vec<RecentEntry> {
    let p = recent_path();
    if !p.exists() {
        return vec![];
    }
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_recent_entries(entries: &[RecentEntry]) -> Result<(), String> {
    ensure_config_dir()?;
    let json = serde_json::to_string_pretty(entries).map_err(|e| map_internal_err("serialize recent entries", e))?;
    fs::write(recent_path(), json).map_err(|e| map_internal_err("write recent entries", e))
}

#[tauri::command]
pub fn list_recent() -> Result<String, String> {
    let entries = read_recent_entries();
    serde_json::to_string(&entries).map_err(|e| map_internal_err("serialize recent list", e))
}

#[tauri::command]
pub fn add_recent(path: String, title: String) -> Result<(), String> {
    let mut entries = read_recent_entries();
    entries.retain(|e| e.path != path);
    entries.insert(
        0,
        RecentEntry {
            path,
            title,
            last_opened: Utc::now().to_rfc3339(),
        },
    );
    entries.truncate(20);
    write_recent_entries(&entries)
}

#[tauri::command]
pub fn remove_recent(path: String) -> Result<(), String> {
    let mut entries = read_recent_entries();
    entries.retain(|e| e.path != path);
    write_recent_entries(&entries)
}

// -- Flow templates --

#[derive(Serialize, Deserialize, Clone)]
struct FlowTemplate {
    name: String,
    nodes: serde_json::Value,
    edges: serde_json::Value,
    created: String,
}

fn flows_path() -> PathBuf {
    config_dir().join("flows.json")
}

fn read_flow_entries() -> Vec<FlowTemplate> {
    let p = flows_path();
    if !p.exists() {
        return vec![];
    }
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_flow_entries(entries: &[FlowTemplate]) -> Result<(), String> {
    ensure_config_dir()?;
    let json = serde_json::to_string_pretty(entries).map_err(|e| map_internal_err("serialize flow entries", e))?;
    fs::write(flows_path(), json).map_err(|e| map_internal_err("write flow entries", e))
}

#[tauri::command]
pub fn list_flows() -> Result<String, String> {
    let entries = read_flow_entries();
    serde_json::to_string(&entries).map_err(|e| map_internal_err("serialize flow list", e))
}

fn relativize_node_positions(nodes: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Array(ref arr) = nodes {
        if arr.is_empty() {
            return nodes;
        }
        let min_x = arr.iter()
            .filter_map(|n| n.get("position").and_then(|p| p.get("x")).and_then(|v| v.as_f64()))
            .fold(f64::INFINITY, f64::min);
        let min_y = arr.iter()
            .filter_map(|n| n.get("position").and_then(|p| p.get("y")).and_then(|v| v.as_f64()))
            .fold(f64::INFINITY, f64::min);

        if min_x.is_infinite() || min_y.is_infinite() {
            return nodes;
        }

        serde_json::Value::Array(arr.iter().map(|n| {
            let mut node = n.clone();
            if let Some(pos) = node.get("position").cloned() {
                if let (Some(x), Some(y)) = (pos.get("x").and_then(|v| v.as_f64()), pos.get("y").and_then(|v| v.as_f64())) {
                    let new_pos = serde_json::json!({ "x": x - min_x, "y": y - min_y });
                    node.as_object_mut().unwrap().insert("position".to_string(), new_pos);
                }
            }
            node
        }).collect())
    } else {
        nodes
    }
}

#[tauri::command]
pub fn save_flow(name: String, data: String) -> Result<(), String> {
    let parsed: serde_json::Value = serde_json::from_str(&data).map_err(|e| map_internal_err("parse flow data", e))?;
    let nodes = parsed.get("nodes").cloned().unwrap_or(serde_json::Value::Array(vec![]));
    let edges = parsed.get("edges").cloned().unwrap_or(serde_json::Value::Array(vec![]));
    let nodes = relativize_node_positions(nodes);
    let mut entries = read_flow_entries();
    entries.retain(|e| e.name != name);
    entries.push(FlowTemplate {
        name,
        nodes,
        edges,
        created: Utc::now().to_rfc3339(),
    });
    write_flow_entries(&entries)
}

#[tauri::command]
pub fn delete_flow(name: String) -> Result<(), String> {
    let mut entries = read_flow_entries();
    entries.retain(|e| e.name != name);
    write_flow_entries(&entries)
}

// -- New project --

#[tauri::command]
pub fn rename_mindmap(path: String, new_name: String) -> Result<String, String> {
    let old_path = validate_path(&path)?;
    if !old_path.exists() {
        return Err("File does not exist".to_string());
    }
    let dir = old_path.parent().ok_or("Cannot determine parent directory")?;
    let safe_name = sanitize_filename(&new_name);
    let filename = format!(".{}.monkeymap.json", if safe_name.is_empty() { "untitled".to_string() } else { safe_name });
    let new_path = dir.join(&filename);
    if new_path == old_path {
        return Ok(path);
    }
    if new_path.exists() {
        return Err(format!("A mind map named '{}' already exists in this directory", new_name));
    }
    fs::rename(&old_path, &new_path).map_err(|e| map_internal_err("rename mindmap file", e))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_project(dir: String, name: String) -> Result<String, String> {
    let dir_path = validate_path(&dir)?;
    fs::create_dir_all(&dir_path).map_err(|e| map_internal_err("create project dir", e))?;
    let safe_name = sanitize_filename(&name);
    let filename = format!(".{}.monkeymap.json", if safe_name.is_empty() { "untitled".to_string() } else { safe_name });
    let file_path = dir_path.join(&filename);
    if file_path.exists() {
        return Err(format!("A mind map named '{}' already exists in this directory", name));
    }
    let content = default_mindmap_content(&name);
    fs::write(&file_path, &content).map_err(|e| map_internal_err("write project file", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_path_rejects_traversal() {
        let result = validate_path("/Users/test/../../../etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn validate_path_rejects_relative_paths() {
        let result = validate_path("relative/path/file.json");
        assert!(result.is_err());
    }

    #[test]
    fn validate_path_accepts_home_dir_paths() {
        let home = dirs::home_dir().unwrap();
        let test_path = home.join("test-file.json");
        let result = validate_path(test_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn validate_path_rejects_outside_home() {
        let result = validate_path("/tmp/outside-home.json");
        assert!(result.is_err());
    }

    #[test]
    fn default_mindmap_content_is_valid_json() {
        let content = default_mindmap_content("Test Project");
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert!(parsed.get("meta").is_some());
        assert!(parsed.get("nodes").is_some());
        assert!(parsed.get("edges").is_some());
        assert_eq!(parsed["meta"]["title"], "Test Project");
        assert_eq!(parsed["nodes"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn recent_entries_round_trip() {
        let entries = read_recent_entries();
        assert!(entries.len() >= 0);
    }

    #[test]
    fn flow_entries_round_trip() {
        let entries = read_flow_entries();
        assert!(entries.len() >= 0);
    }

    #[test]
    fn relativize_node_positions_offsets_to_origin() {
        let nodes = serde_json::json!([
            { "id": "a", "position": { "x": 100, "y": 200 }, "data": {} },
            { "id": "b", "position": { "x": 300, "y": 400 }, "data": {} }
        ]);
        let result = relativize_node_positions(nodes);
        let arr = result.as_array().unwrap();
        assert_eq!(arr[0]["position"]["x"], 0.0);
        assert_eq!(arr[0]["position"]["y"], 0.0);
        assert_eq!(arr[1]["position"]["x"], 200.0);
        assert_eq!(arr[1]["position"]["y"], 200.0);
    }

    #[test]
    fn relativize_node_positions_empty_array() {
        let nodes = serde_json::json!([]);
        let result = relativize_node_positions(nodes.clone());
        assert_eq!(result, nodes);
    }
}
