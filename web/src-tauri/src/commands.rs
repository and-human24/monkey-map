use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

fn config_dir() -> PathBuf {
    dirs::home_dir().expect("HOME directory must be set").join(".monkey-map")
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

// -- Folder-based storage (v2) --

fn is_folder_project(path: &Path) -> bool {
    path.is_dir() && path.extension().map_or(false, |e| e == "monkeymap")
}

fn safe_node_id(id: &str) -> Result<&str, String> {
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err(format!("Invalid node ID: {}", id));
    }
    Ok(id)
}

fn validate_subpath(child: &Path, parent: &Path) -> Result<(), String> {
    if child.exists() {
        let canonical = child.canonicalize().map_err(|e| map_internal_err("canonicalize subpath", e))?;
        let parent_canonical = parent.canonicalize().map_err(|e| map_internal_err("canonicalize parent", e))?;
        if !canonical.starts_with(&parent_canonical) {
            return Err("Symlink escape detected: subpath resolves outside project".to_string());
        }
    }
    Ok(())
}

fn read_project_folder(path: &Path) -> Result<String, String> {
    let manifest_path = path.join("manifest.json");
    let manifest_str = fs::read_to_string(&manifest_path)
        .map_err(|e| map_internal_err("read manifest.json", e))?;
    let mut data: serde_json::Value = serde_json::from_str(&manifest_str)
        .map_err(|e| map_internal_err("parse manifest.json", e))?;

    // inject details from nodes/*.md
    if let Some(nodes) = data.get_mut("nodes").and_then(|n| n.as_array_mut()) {
        let nodes_dir = path.join("nodes");
        for node in nodes.iter_mut() {
            let has_details = node.pointer("/data/hasDetails").and_then(|v| v.as_bool()).unwrap_or(false);
            if has_details {
                if let Some(id) = node.get("id").and_then(|v| v.as_str()) {
                    let id = match safe_node_id(id) { Ok(id) => id, Err(_) => continue };
                    let md_path = nodes_dir.join(format!("{}.md", id));
                    if validate_subpath(&md_path, path).is_err() { continue; }
                    let details = fs::read_to_string(&md_path).unwrap_or_default();
                    if let Some(data_obj) = node.get_mut("data").and_then(|d| d.as_object_mut()) {
                        data_obj.remove("hasDetails");
                        if !details.is_empty() {
                            data_obj.insert("details".to_string(), serde_json::Value::String(details));
                        }
                    }
                }
            }
        }
    }

    // strip version field (app expects MindMapData shape)
    if let Some(obj) = data.as_object_mut() {
        obj.remove("version");
    }

    serde_json::to_string(&data).map_err(|e| map_internal_err("serialize assembled data", e))
}

fn write_project_folder(path: &Path, data: &str) -> Result<(), String> {
    let parsed: serde_json::Value = serde_json::from_str(data)
        .map_err(|e| map_internal_err("parse mindmap data", e))?;

    let nodes_dir = path.join("nodes");
    fs::create_dir_all(&nodes_dir).map_err(|e| map_internal_err("create nodes dir", e))?;

    // build manifest: strip details, set hasDetails
    let mut manifest = parsed.clone();
    let mut node_details: HashMap<String, String> = HashMap::new();

    if let Some(nodes) = manifest.get_mut("nodes").and_then(|n| n.as_array_mut()) {
        for node in nodes.iter_mut() {
            if let Some(data_obj) = node.get_mut("data").and_then(|d| d.as_object_mut()) {
                let details = data_obj.remove("details")
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                let has_details = !details.trim().is_empty();
                data_obj.insert("hasDetails".to_string(), serde_json::Value::Bool(has_details));
                if has_details {
                    if let Some(id) = node.get("id").and_then(|v| v.as_str()) {
                        node_details.insert(id.to_string(), details);
                    }
                }
            }
        }
    }

    // add version
    if let Some(obj) = manifest.as_object_mut() {
        obj.insert("version".to_string(), serde_json::Value::Number(2.into()));
    }

    // diff-write manifest.json
    let manifest_str = serde_json::to_string_pretty(&manifest)
        .map_err(|e| map_internal_err("serialize manifest", e))?;
    let manifest_path = path.join("manifest.json");
    let existing_manifest = fs::read_to_string(&manifest_path).unwrap_or_default();
    let mut write_count: u32 = 0;
    if manifest_str != existing_manifest {
        fs::write(&manifest_path, &manifest_str).map_err(|e| map_internal_err("write manifest.json", e))?;
        write_count += 1;
    }

    // diff-write node .md files
    for (id, details) in &node_details {
        let id = safe_node_id(id)?;
        let md_path = nodes_dir.join(format!("{}.md", id));
        validate_subpath(&md_path, path).ok(); // warn but don't block new file writes
        let existing = fs::read_to_string(&md_path).unwrap_or_default();
        if *details != existing {
            fs::write(&md_path, details).map_err(|e| map_internal_err("write node md", e))?;
            write_count += 1;
        }
    }

    // delete orphaned .md files
    if let Ok(entries) = fs::read_dir(&nodes_dir) {
        let all_node_ids: HashSet<String> = manifest.get("nodes")
            .and_then(|n| n.as_array())
            .map(|arr| arr.iter().filter_map(|n| n.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())).collect())
            .unwrap_or_default();
        for entry in entries.flatten() {
            if let Some(stem) = entry.path().file_stem().and_then(|s| s.to_str()).map(|s| s.to_string()) {
                if entry.path().extension().map_or(false, |e| e == "md") && !all_node_ids.contains(&stem) && !entry.path().is_symlink() {
                    let _ = fs::remove_file(entry.path());
                    write_count += 1;
                }
            }
        }
    }

    // generate map.md
    let map_md = generate_map_md(&parsed);
    let map_md_path = path.join("map.md");
    let existing_map = fs::read_to_string(&map_md_path).unwrap_or_default();
    if map_md != existing_map {
        fs::write(&map_md_path, &map_md).map_err(|e| map_internal_err("write map.md", e))?;
        write_count += 1;
    }

    // mark self-writes for watcher (one per file actually written)
    for _ in 1..write_count {
        crate::watcher::mark_self_write();
    }

    Ok(())
}

fn generate_map_md(data: &serde_json::Value) -> String {
    let title = data.pointer("/meta/title").and_then(|v| v.as_str()).unwrap_or("Untitled");
    let nodes = data.get("nodes").and_then(|n| n.as_array());
    let edges = data.get("edges").and_then(|e| e.as_array());

    let nodes = match nodes {
        Some(n) => n,
        None => return format!("# {}\n", title),
    };
    let edges = edges.cloned().unwrap_or_default();

    // build node label map
    let mut labels: HashMap<String, String> = HashMap::new();
    for node in nodes {
        if let (Some(id), Some(label)) = (
            node.get("id").and_then(|v| v.as_str()),
            node.pointer("/data/label").and_then(|v| v.as_str()),
        ) {
            labels.insert(id.to_string(), label.to_string());
        }
    }

    // classify edges by handle positions
    let mut hierarchical: Vec<(String, String)> = Vec::new(); // (parent, child)
    let mut associations: Vec<(String, String)> = Vec::new();

    for edge in &edges {
        let source = edge.get("source").and_then(|v| v.as_str()).unwrap_or_default();
        let target = edge.get("target").and_then(|v| v.as_str()).unwrap_or_default();
        let source_handle = edge.get("sourceHandle").and_then(|v| v.as_str()).unwrap_or("bottom");
        let target_handle = edge.get("targetHandle").and_then(|v| v.as_str()).unwrap_or("top");

        let src_horizontal = source_handle == "left" || source_handle == "right";
        let tgt_horizontal = target_handle == "left" || target_handle == "right";

        if src_horizontal && tgt_horizontal {
            associations.push((source.to_string(), target.to_string()));
        } else {
            // vertical or mixed = hierarchy
            if source_handle == "top" && target_handle == "bottom" {
                // reversed: target is parent
                hierarchical.push((target.to_string(), source.to_string()));
            } else {
                // source is parent (bottom->top, or mixed)
                hierarchical.push((source.to_string(), target.to_string()));
            }
        }
    }

    // build children map and find roots
    let mut children: HashMap<String, Vec<String>> = HashMap::new();
    let mut has_parent: HashSet<String> = HashSet::new();
    // cycle detection: track visited during DFS
    for (parent, child) in &hierarchical {
        children.entry(parent.clone()).or_default().push(child.clone());
        has_parent.insert(child.clone());
    }

    // association map (source -> targets)
    let mut assoc_map: HashMap<String, Vec<String>> = HashMap::new();
    for (src, tgt) in &associations {
        assoc_map.entry(src.clone()).or_default().push(tgt.clone());
    }

    let all_ids: HashSet<String> = labels.keys().cloned().collect();
    let roots: Vec<String> = nodes.iter()
        .filter_map(|n| n.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .filter(|id| !has_parent.contains(id) && (children.contains_key(id) || assoc_map.contains_key(id) || hierarchical.iter().any(|(p, _)| p == id)))
        .collect();

    // disconnected = not in any edge
    let connected: HashSet<String> = {
        let mut s = HashSet::new();
        for (p, c) in &hierarchical { s.insert(p.clone()); s.insert(c.clone()); }
        for (a, b) in &associations { s.insert(a.clone()); s.insert(b.clone()); }
        s
    };
    let disconnected: Vec<String> = all_ids.iter().filter(|id| !connected.contains(*id)).cloned().collect();
    // also roots that aren't in roots list but have no parent and no children
    let rootless: Vec<String> = all_ids.iter()
        .filter(|id| !has_parent.contains(*id) && !roots.contains(id) && connected.contains(*id))
        .cloned().collect();

    let mut output = format!("# {}\n\n", title);

    // render tree recursively
    let mut visited: HashSet<String> = HashSet::new();
    fn render_tree(
        id: &str, depth: usize, labels: &HashMap<String, String>,
        children: &HashMap<String, Vec<String>>, assoc_map: &HashMap<String, Vec<String>>,
        visited: &mut HashSet<String>, output: &mut String,
    ) {
        if visited.contains(id) { return; }
        visited.insert(id.to_string());
        let label = labels.get(id).map(|s| s.as_str()).unwrap_or("?");
        let indent = "  ".repeat(depth);
        output.push_str(&format!("{}- {} [{}]\n", indent, label, id));
        if let Some(kids) = children.get(id) {
            for kid in kids {
                render_tree(kid, depth + 1, labels, children, assoc_map, visited, output);
            }
        }
        if let Some(assocs) = assoc_map.get(id) {
            for a in assocs {
                if !visited.contains(a) {
                    visited.insert(a.to_string());
                    let a_label = labels.get(a).map(|s| s.as_str()).unwrap_or("?");
                    output.push_str(&format!("{}  ~ {} [{}]\n", indent, a_label, a));
                }
            }
        }
    }

    for root in &roots {
        render_tree(root, 0, &labels, &children, &assoc_map, &mut visited, &mut output);
    }
    for root in &rootless {
        render_tree(root, 0, &labels, &children, &assoc_map, &mut visited, &mut output);
    }

    if !disconnected.is_empty() {
        output.push_str("\n## Unlinked\n\n");
        for id in &disconnected {
            let label = labels.get(id).map(|s| s.as_str()).unwrap_or("?");
            output.push_str(&format!("- {} [{}]\n", label, id));
        }
    }

    output
}

pub fn reassemble_folder(path: &Path) -> Result<String, String> {
    read_project_folder(path)
}

// -- Mindmap file operations --

#[tauri::command]
pub fn read_mindmap(path: String) -> Result<String, String> {
    let p = validate_path(&path)?;
    if is_folder_project(&p) {
        return read_project_folder(&p);
    }
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
    if is_folder_project(&p) {
        return write_project_folder(&p, &data);
    }
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
        .add_filter("Mind Map", &["json", "monkeymap"])
        .blocking_pick_file();

    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn pick_mindmap_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.dialog().file().blocking_pick_folder();
    match dir {
        Some(d) => {
            let path = d.to_string();
            let p = Path::new(&path);
            if is_folder_project(p) {
                Ok(Some(path))
            } else {
                Err("Selected folder is not a .monkeymap project".to_string())
            }
        }
        None => Ok(None),
    }
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
    let safe = if safe_name.is_empty() { "untitled".to_string() } else { safe_name };

    let is_folder = is_folder_project(&old_path);
    let new_name_str = if is_folder {
        format!(".{}.monkeymap", safe)
    } else {
        format!(".{}.monkeymap.json", safe)
    };
    let new_path = dir.join(&new_name_str);
    if new_path == old_path {
        return Ok(path);
    }
    if new_path.exists() {
        return Err(format!("A mind map named '{}' already exists in this directory", new_name));
    }
    fs::rename(&old_path, &new_path).map_err(|e| map_internal_err("rename mindmap", e))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn migrate_to_folder(path: String) -> Result<String, String> {
    let old_path = validate_path(&path)?;
    if !old_path.exists() || !old_path.is_file() {
        return Err("Source file does not exist".to_string());
    }
    let content = fs::read_to_string(&old_path)
        .map_err(|e| map_internal_err("read source file", e))?;

    // derive folder name: .foo.monkeymap.json -> .foo.monkeymap
    let file_name = old_path.file_name().and_then(|n| n.to_str()).unwrap_or("untitled.monkeymap.json");
    let folder_name = file_name.strip_suffix(".json").unwrap_or(file_name);
    let dir = old_path.parent().ok_or("Cannot determine parent directory")?;
    let folder_path = dir.join(folder_name);

    if folder_path.exists() {
        return Err(format!("Folder '{}' already exists", folder_name));
    }
    fs::create_dir_all(folder_path.join("nodes"))
        .map_err(|e| map_internal_err("create folder structure", e))?;

    write_project_folder(&folder_path, &content)?;
    // keep old file intact as backup
    Ok(folder_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_project(dir: String, name: String) -> Result<String, String> {
    let dir_path = validate_path(&dir)?;
    fs::create_dir_all(&dir_path).map_err(|e| map_internal_err("create project dir", e))?;
    let safe_name = sanitize_filename(&name);
    let folder_name = format!(".{}.monkeymap", if safe_name.is_empty() { "untitled".to_string() } else { safe_name });
    let folder_path = dir_path.join(&folder_name);
    if folder_path.exists() {
        return Err(format!("A mind map named '{}' already exists in this directory", name));
    }
    let nodes_dir = folder_path.join("nodes");
    fs::create_dir_all(&nodes_dir).map_err(|e| map_internal_err("create nodes dir", e))?;

    let content = default_mindmap_content(&name);
    // write via folder helpers to get manifest + map.md
    write_project_folder(&folder_path, &content)?;

    Ok(folder_path.to_string_lossy().to_string())
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

    #[test]
    fn generate_map_md_basic_hierarchy() {
        let data = serde_json::json!({
            "meta": { "title": "Test Map" },
            "nodes": [
                { "id": "root", "data": { "label": "Root" } },
                { "id": "child1", "data": { "label": "Child One" } },
                { "id": "child2", "data": { "label": "Child Two" } }
            ],
            "edges": [
                { "source": "root", "target": "child1", "sourceHandle": "bottom", "targetHandle": "top" },
                { "source": "root", "target": "child2", "sourceHandle": "bottom", "targetHandle": "top" }
            ]
        });
        let md = generate_map_md(&data);
        assert!(md.contains("# Test Map"));
        assert!(md.contains("- Root [root]"));
        assert!(md.contains("  - Child One [child1]"));
        assert!(md.contains("  - Child Two [child2]"));
    }

    #[test]
    fn generate_map_md_association() {
        let data = serde_json::json!({
            "meta": { "title": "Assoc Test" },
            "nodes": [
                { "id": "a", "data": { "label": "Node A" } },
                { "id": "b", "data": { "label": "Node B" } }
            ],
            "edges": [
                { "source": "a", "target": "b", "sourceHandle": "right", "targetHandle": "left" }
            ]
        });
        let md = generate_map_md(&data);
        assert!(md.contains("~ Node B [b]"));
    }

    #[test]
    fn generate_map_md_disconnected_nodes() {
        let data = serde_json::json!({
            "meta": { "title": "Disco" },
            "nodes": [
                { "id": "lone", "data": { "label": "Lonely" } }
            ],
            "edges": []
        });
        let md = generate_map_md(&data);
        assert!(md.contains("## Unlinked"));
        assert!(md.contains("- Lonely [lone]"));
    }

    #[test]
    fn folder_round_trip() {
        let tmp = std::env::temp_dir().join("test_monkeymap_roundtrip.monkeymap");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("nodes")).unwrap();

        let data = serde_json::json!({
            "meta": { "title": "Round Trip", "created": "2026-01-01T00:00:00Z", "viewport": { "x": 0, "y": 0, "zoom": 1 } },
            "nodes": [
                { "id": "n1", "type": "mindmap", "position": { "x": 0, "y": 0 }, "data": { "label": "First", "details": "Some details here" } },
                { "id": "n2", "type": "mindmap", "position": { "x": 100, "y": 100 }, "data": { "label": "Second" } }
            ],
            "edges": [
                { "id": "e1", "source": "n1", "target": "n2", "sourceHandle": "bottom", "targetHandle": "top" }
            ]
        }).to_string();

        write_project_folder(&tmp, &data).unwrap();

        // verify files exist
        assert!(tmp.join("manifest.json").exists());
        assert!(tmp.join("map.md").exists());
        assert!(tmp.join("nodes/n1.md").exists());
        assert!(!tmp.join("nodes/n2.md").exists()); // no details

        // read back
        let reassembled = read_project_folder(&tmp).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&reassembled).unwrap();
        assert_eq!(parsed["meta"]["title"], "Round Trip");
        assert_eq!(parsed["nodes"][0]["data"]["details"], "Some details here");
        assert!(parsed["nodes"][1]["data"].get("details").is_none());

        // verify map.md content
        let map_md = fs::read_to_string(tmp.join("map.md")).unwrap();
        assert!(map_md.contains("- First [n1]"));
        assert!(map_md.contains("  - Second [n2]"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn folder_orphan_cleanup() {
        let tmp = std::env::temp_dir().join("test_monkeymap_orphan.monkeymap");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("nodes")).unwrap();

        // write initial data with 2 nodes
        let data1 = serde_json::json!({
            "meta": { "title": "Test", "created": "2026-01-01T00:00:00Z", "viewport": { "x": 0, "y": 0, "zoom": 1 } },
            "nodes": [
                { "id": "keep", "type": "mindmap", "position": { "x": 0, "y": 0 }, "data": { "label": "Keep", "details": "kept" } },
                { "id": "remove", "type": "mindmap", "position": { "x": 0, "y": 0 }, "data": { "label": "Remove", "details": "gone" } }
            ],
            "edges": []
        }).to_string();
        write_project_folder(&tmp, &data1).unwrap();
        assert!(tmp.join("nodes/remove.md").exists());

        // write again without "remove" node
        let data2 = serde_json::json!({
            "meta": { "title": "Test", "created": "2026-01-01T00:00:00Z", "viewport": { "x": 0, "y": 0, "zoom": 1 } },
            "nodes": [
                { "id": "keep", "type": "mindmap", "position": { "x": 0, "y": 0 }, "data": { "label": "Keep", "details": "kept" } }
            ],
            "edges": []
        }).to_string();
        write_project_folder(&tmp, &data2).unwrap();
        assert!(!tmp.join("nodes/remove.md").exists());
        assert!(tmp.join("nodes/keep.md").exists());

        let _ = fs::remove_dir_all(&tmp);
    }
}
