use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionFile {
    current_path: String,
    lang: String,
    mind_map_config: Value,
    local_config: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSession {
    path: String,
    file_name: String,
    mind_map_data: Value,
    mind_map_config: Value,
    lang: String,
    local_config: Value,
}

struct AppState {
    docs_dir: PathBuf,
    session_path: PathBuf,
    session: Mutex<SessionFile>,
    pending_open: Mutex<Option<PathBuf>>,
}

fn empty_document() -> Value {
    json!({
        "layout": "logicalStructure",
        "root": {
            "data": { "text": "根节点" },
            "children": []
        },
        "theme": {
            "template": "default",
            "config": {}
        },
        "view": null
    })
}

fn normalize_document(value: Value) -> Value {
    if value.get("root").is_some() {
        return value;
    }
    if value.get("data").is_some() {
        let mut document = empty_document();
        document["root"] = value;
        return document;
    }
    value
}

const FRONTEND_PORT: u16 = 17321;

fn start_frontend_server(app: AppHandle) -> Result<(), String> {
    let listener = TcpListener::bind(("127.0.0.1", FRONTEND_PORT)).map_err(|error| {
        format!("本机端口 {FRONTEND_PORT} 已被占用，请先关掉另一个 Mind 窗口：{error}")
    })?;
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else {
                continue;
            };
            let app = app.clone();
            std::thread::spawn(move || {
                let _ = serve_frontend(&app, &mut stream);
            });
        }
    });
    Ok(())
}

fn serve_frontend(app: &AppHandle, stream: &mut TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let mut buffer = [0_u8; 4096];
    let read = stream.read(&mut buffer)?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let request_path = request
        .lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .nth(1)
        .unwrap_or("/");
    let request_path = request_path.split('?').next().unwrap_or("/");
    let asset_path = if request_path == "/" {
        "index.html".to_string()
    } else {
        request_path.trim_start_matches('/').to_string()
    };
    if let Some(asset) = app.asset_resolver().get(asset_path) {
        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            asset.mime_type,
            asset.bytes.len()
        );
        stream.write_all(header.as_bytes())?;
        stream.write_all(&asset.bytes)?;
    } else {
        let body = b"not found";
        let header = format!(
            "HTTP/1.1 404 Not Found\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream.write_all(header.as_bytes())?;
        stream.write_all(body)?;
    }
    Ok(())
}

fn file_name_of(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "未命名.xmind".to_string())
}

fn write_text_atomic(path: &Path, text: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let tmp_name = format!(
        ".{}.tmp",
        path.file_name().and_then(|name| name.to_str()).unwrap_or("file")
    );
    let tmp_path = path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(tmp_name);
    fs::write(&tmp_path, text).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, path).map_err(|error| error.to_string())?;
    Ok(())
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    write_text_atomic(path, &text)
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| format!("无法解析 {}: {error}", path.display()))
}

fn ensure_xmind(path: PathBuf) -> PathBuf {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("xmind") | Some("smm") | Some("json") => path,
        _ => path.with_extension("xmind"),
    }
}

fn next_untitled(dir: &Path) -> PathBuf {
    let first = dir.join("未命名.xmind");
    if !first.exists() {
        return first;
    }
    for index in 2..1000 {
        let candidate = dir.join(format!("未命名 {index}.xmind"));
        if !candidate.exists() {
            return candidate;
        }
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    dir.join(format!("未命名 {stamp}.xmind"))
}

fn set_window_title(app: &AppHandle, file_name: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!("{file_name} — Mind"));
    }
}

fn persist_session(state: &AppState, session: &SessionFile) -> Result<(), String> {
    let value = serde_json::to_value(session).map_err(|error| error.to_string())?;
    write_json(&state.session_path, &value)
}

fn load_session_file(path: &Path) -> Option<SessionFile> {
    let value = read_json(path).ok()?;
    serde_json::from_value(value).ok()
}

fn create_document(path: &Path) -> Result<Value, String> {
    let document = empty_document();
    write_document(path, &document)?;
    Ok(document)
}

fn read_document(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let value = if bytes.len() >= 4 && &bytes[..4] == b"PK\x03\x04" {
        read_xmind_bytes(&bytes)?
    } else {
        serde_json::from_slice(&bytes).map_err(|error| error.to_string())?
    };
    Ok(normalize_document(value))
}

fn write_document(path: &Path, data: &Value) -> Result<(), String> {
    if path.extension().and_then(|ext| ext.to_str()) == Some("xmind") {
        write_xmind(path, data)
    } else {
        write_json(path, data)
    }
}

fn plain_text(value: &Value) -> String {
    let raw = value.as_str().unwrap_or("");
    let mut text = String::new();
    let mut in_tag = false;
    for ch in raw.chars() {
        if ch == '<' {
            in_tag = true;
            continue;
        }
        if ch == '>' {
            in_tag = false;
            continue;
        }
        if !in_tag {
            text.push(ch);
        }
    }
    text
}

fn topic_from_node(node: &Value, relationships: &mut Vec<Value>) -> Value {
    let data = node.get("data").cloned().unwrap_or_else(|| json!({}));
    let uid = data
        .get("uid")
        .and_then(|value| value.as_str())
        .unwrap_or("node")
        .to_string();
    if let Some(targets) = data.get("associativeLineTargets").and_then(|value| value.as_array()) {
        for target in targets {
            let Some(target_id) = target.as_str() else {
                continue;
            };
            let mut relationship = json!({
                "id": format!("rel-{uid}-{target_id}"),
                "end1Id": uid,
                "end2Id": target_id
            });
            if let Some(title) = data
                .get("associativeLineText")
                .and_then(|value| value.get(target_id))
                .and_then(|value| value.as_str())
            {
                relationship["title"] = json!(title);
            }
            relationships.push(relationship);
        }
    }
    let mut topic = json!({
        "id": uid,
        "class": "topic",
        "title": plain_text(data.get("text").unwrap_or(&Value::Null)),
        "children": { "attached": [] }
    });
    if let Some(children) = node.get("children").and_then(|value| value.as_array()) {
        for child in children {
            topic["children"]["attached"]
                .as_array_mut()
                .expect("attached children")
                .push(topic_from_node(child, relationships));
        }
    }
    topic
}

fn xmind_content(data: &Value) -> Value {
    let root = data.get("root").unwrap_or(data);
    let mut relationships = Vec::new();
    let root_topic = topic_from_node(root, &mut relationships);
    let sheet_id = format!(
        "sheet-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    );
    json!([{
        "id": sheet_id,
        "class": "sheet",
        "title": "Mind",
        "rootTopic": root_topic,
        "relationships": relationships,
        "topicPositioning": "fixed",
        "topicOverlapping": "overlap",
        "coreVersion": "2.100.0"
    }])
}

fn write_xmind(path: &Path, data: &Value) -> Result<(), String> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut cursor);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    let files = [
        ("mind.json", serde_json::to_vec_pretty(data).map_err(|error| error.to_string())?),
        (
            "content.json",
            serde_json::to_vec(&xmind_content(data)).map_err(|error| error.to_string())?,
        ),
        (
            "metadata.json",
            br#"{"dataStructureVersion":"2","creator":{"name":"Mind"},"layoutEngineVersion":"3"}"#
                .to_vec(),
        ),
        (
            "manifest.json",
            br#"{"file-entries":{"content.json":{},"metadata.json":{},"mind.json":{}}}"#.to_vec(),
        ),
    ];
    for (name, bytes) in files {
        zip.start_file(name, options)
            .map_err(|error| error.to_string())?;
        zip.write_all(&bytes).map_err(|error| error.to_string())?;
    }
    zip.finish().map_err(|error| error.to_string())?;
    let bytes = cursor.into_inner();
    let tmp = path.with_extension("xmind.tmp");
    fs::write(&tmp, &bytes).map_err(|error| error.to_string())?;
    fs::rename(&tmp, path).map_err(|error| error.to_string())
}

fn read_zip_file(archive: &mut zip::ZipArchive<std::io::Cursor<Vec<u8>>>, name: &str) -> Option<Vec<u8>> {
    let mut file = archive.by_name(name).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    Some(bytes)
}

fn topic_to_node(topic: &Value) -> Value {
    let mut node = json!({
        "data": {
            "text": topic.get("title").and_then(|value| value.as_str()).unwrap_or(""),
            "uid": topic.get("id").and_then(|value| value.as_str()).unwrap_or("")
        },
        "children": []
    });
    if let Some(attached) = topic
        .get("children")
        .and_then(|value| value.get("attached"))
        .and_then(|value| value.as_array())
    {
        for child in attached {
            node["children"]
                .as_array_mut()
                .expect("children")
                .push(topic_to_node(child));
        }
    }
    node
}

fn add_associative_line(node: &mut Value, from: &str, to: &str, title: Option<&str>) -> bool {
    let uid = node
        .get("data")
        .and_then(|data| data.get("uid"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    if uid == from {
        let targets = node["data"]
            .as_object_mut()
            .expect("node data")
            .entry("associativeLineTargets")
            .or_insert_with(|| json!([]));
        if let Some(list) = targets.as_array_mut() {
            list.push(json!(to));
        }
        if let Some(title) = title {
            node["data"]
                .as_object_mut()
                .expect("node data")
                .entry("associativeLineText")
                .or_insert_with(|| json!({}))[to] = json!(title);
        }
        return true;
    }
    if let Some(children) = node.get_mut("children").and_then(|value| value.as_array_mut()) {
        for child in children {
            if add_associative_line(child, from, to, title) {
                return true;
            }
        }
    }
    false
}

fn xmind_content_to_document(content: &Value) -> Value {
    let sheet = content.as_array().and_then(|sheets| sheets.first()).unwrap_or(content);
    let Some(root_topic) = sheet.get("rootTopic") else {
        return empty_document();
    };
    let mut root = topic_to_node(root_topic);
    if let Some(relationships) = sheet.get("relationships").and_then(|value| value.as_array()) {
        for relationship in relationships {
            let Some(from) = relationship.get("end1Id").and_then(|value| value.as_str()) else {
                continue;
            };
            let Some(to) = relationship.get("end2Id").and_then(|value| value.as_str()) else {
                continue;
            };
            let title = relationship.get("title").and_then(|value| value.as_str());
            add_associative_line(&mut root, from, to, title);
        }
    }
    json!({
        "layout": "logicalStructure",
        "root": root,
        "theme": { "template": "default", "config": {} },
        "view": null
    })
}

fn read_xmind_bytes(bytes: &[u8]) -> Result<Value, String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec()))
        .map_err(|error| error.to_string())?;
    if let Some(mind) = read_zip_file(&mut archive, "mind.json") {
        return serde_json::from_slice(&mind).map_err(|error| error.to_string());
    }
    let content = read_zip_file(&mut archive, "content.json")
        .ok_or_else(|| "xmind 文件里没有内容".to_string())?;
    let content: Value = serde_json::from_slice(&content).map_err(|error| error.to_string())?;
    Ok(xmind_content_to_document(&content))
}

fn session_view(session: &SessionFile, document: Value) -> DesktopSession {
    let path = PathBuf::from(&session.current_path);
    DesktopSession {
        file_name: file_name_of(&path),
        path: session.current_path.clone(),
        mind_map_data: document,
        mind_map_config: session.mind_map_config.clone(),
        lang: session.lang.clone(),
        local_config: session.local_config.clone(),
    }
}

fn switch_to(state: &AppState, app: &AppHandle, path: PathBuf) -> Result<DesktopSession, String> {
    let document = if path.exists() {
        read_document(&path)?
    } else {
        create_document(&path)?
    };
    let mut session = state.session.lock().map_err(|error| error.to_string())?;
    session.current_path = path.to_string_lossy().into_owned();
    persist_session(state, &session)?;
    let view = session_view(&session, document);
    set_window_title(app, &view.file_name);
    Ok(view)
}

fn pick_file(app: &AppHandle, directory: PathBuf, save: bool) -> Result<Option<PathBuf>, String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let mut dialog = rfd::FileDialog::new()
            .set_directory(&directory)
            .add_filter("Mind", &["xmind", "smm", "json"]);
        let picked = if save {
            dialog = dialog.set_file_name("未命名.xmind");
            dialog.save_file().map(ensure_xmind)
        } else {
            dialog.pick_file()
        };
        let _ = sender.send(picked);
    })
    .map_err(|error| error.to_string())?;
    receiver.recv().map_err(|error| error.to_string())
}

fn initial_state(app: &AppHandle) -> Result<AppState, String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| error.to_string())?;
    let docs_dir = documents.join("Mind");
    let legacy_dir = documents.join("思维导图");
    if !docs_dir.exists() && legacy_dir.exists() {
        fs::rename(&legacy_dir, &docs_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&docs_dir).map_err(|error| error.to_string())?;
    let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;
    let session_path = app_dir.join("session.json");
    let mut session = load_session_file(&session_path).unwrap_or_else(|| SessionFile {
        current_path: docs_dir.join("未命名.xmind").to_string_lossy().into_owned(),
        lang: "zh".to_string(),
        mind_map_config: json!({}),
        local_config: Value::Null,
    });
    if session.current_path.contains("/思维导图/") {
        let migrated = session.current_path.replace("/思维导图/", "/Mind/");
        if Path::new(&migrated).exists() {
            session.current_path = migrated;
        }
    }
    if session.current_path.ends_with(".smm") {
        let old_path = PathBuf::from(&session.current_path);
        let new_path = old_path.with_extension("xmind");
        if old_path.exists() && !new_path.exists() {
            if let Ok(data) = read_document(&old_path) {
                if write_document(&new_path, &data).is_ok() {
                    session.current_path = new_path.to_string_lossy().into_owned();
                }
            }
        } else if new_path.exists() {
            session.current_path = new_path.to_string_lossy().into_owned();
        }
        let value = serde_json::to_value(&session).map_err(|error| error.to_string())?;
        write_json(&session_path, &value)?;
    }
    Ok(AppState {
        docs_dir,
        session_path,
        session: Mutex::new(session),
        pending_open: Mutex::new(None),
    })
}

#[tauri::command]
fn bootstrap(app: AppHandle, state: State<AppState>) -> Result<DesktopSession, String> {
    let pending = state
        .pending_open
        .lock()
        .map_err(|error| error.to_string())?
        .take();
    let path = pending.unwrap_or_else(|| {
        PathBuf::from(
            state
                .session
                .lock()
                .map(|session| session.current_path.clone())
                .unwrap_or_else(|_| String::new()),
        )
    });
    let path = if path.as_os_str().is_empty() {
        next_untitled(&state.docs_dir)
    } else {
        path
    };
    switch_to(&state, &app, path)
}

#[tauri::command]
fn save_mind_map(state: State<AppState>, data: Value) -> Result<(), String> {
    let session = state.session.lock().map_err(|error| error.to_string())?;
    write_document(Path::new(&session.current_path), &data)
}

#[tauri::command]
fn save_config(state: State<AppState>, config: Value) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|error| error.to_string())?;
    session.mind_map_config = config;
    persist_session(&state, &session)
}

#[tauri::command]
fn save_lang(state: State<AppState>, lang: String) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|error| error.to_string())?;
    session.lang = lang;
    persist_session(&state, &session)
}

#[tauri::command]
fn save_local_config(state: State<AppState>, config: Value) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|error| error.to_string())?;
    session.local_config = config;
    persist_session(&state, &session)
}

#[tauri::command]
fn new_file(app: AppHandle, state: State<AppState>) -> Result<DesktopSession, String> {
    let path = next_untitled(&state.docs_dir);
    switch_to(&state, &app, path)
}

#[tauri::command]
fn open_file(app: AppHandle, state: State<AppState>) -> Result<Option<DesktopSession>, String> {
    let Some(path) = pick_file(&app, state.docs_dir.clone(), false)? else {
        return Ok(None);
    };
    switch_to(&state, &app, path).map(Some)
}

#[tauri::command]
fn save_file_as(
    app: AppHandle,
    state: State<AppState>,
    data: Value,
) -> Result<Option<DesktopSession>, String> {
    let Some(path) = pick_file(&app, state.docs_dir.clone(), true)? else {
        return Ok(None);
    };
    write_document(&path, &data)?;
    let mut session = state.session.lock().map_err(|error| error.to_string())?;
    session.current_path = path.to_string_lossy().into_owned();
    persist_session(&state, &session)?;
    let view = session_view(&session, data);
    set_window_title(&app, &view.file_name);
    Ok(Some(view))
}

#[tauri::command]
fn boot_log(_message: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn reveal_documents(state: State<AppState>) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&state.docs_dir)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn take_pending_open(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Option<DesktopSession>, String> {
    let pending = state
        .pending_open
        .lock()
        .map_err(|error| error.to_string())?
        .take();
    let Some(path) = pending else {
        return Ok(None);
    };
    switch_to(&state, &app, path).map(Some)
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let app_menu = Submenu::with_items(
        app,
        "Mind",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Mind"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some("Hide Mind"))?,
            &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
            &PredefinedMenuItem::show_all(app, Some("Show All"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit Mind"))?,
        ],
    )?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "new", "New", true, Some("CmdOrCtrl+N"))?,
            &MenuItem::with_id(app, "open", "Open…", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(
                app,
                "save-as",
                "Save As…",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "reveal", "Show in Finder", true, None::<&str>)?,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::cut(app, Some("Cut"))?,
            &PredefinedMenuItem::copy(app, Some("Copy"))?,
            &PredefinedMenuItem::paste(app, Some("Paste"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::select_all(app, Some("Select All"))?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu])
}

fn dispatch_menu(app: &AppHandle, action: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let script = format!("window.__desktopOnMenu && window.__desktopOnMenu({action:?})");
        let _ = window.eval(&script);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| {
            dispatch_menu(app, event.id().as_ref());
        })
        .setup(|app| {
            let state = initial_state(app.handle()).map_err(std::io::Error::other)?;
            app.manage(state);
            // macOS 的 tauri:// 自定义协议能跑脚本，但网页视图经常是白的。
            // 开发时用的 localhost 是正常的，所以正式包也改由本机 HTTP 提供页面。
            #[cfg(not(debug_assertions))]
            {
                start_frontend_server(app.handle().clone()).map_err(std::io::Error::other)?;
                if let Some(window) = app.get_webview_window("main") {
                    let url = format!("http://127.0.0.1:{FRONTEND_PORT}/")
                        .parse()
                        .map_err(std::io::Error::other)?;
                    window.navigate(url).map_err(std::io::Error::other)?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            save_mind_map,
            save_config,
            save_lang,
            save_local_config,
            new_file,
            open_file,
            save_file_as,
            reveal_documents,
            take_pending_open,
            boot_log
        ])
        .build(tauri::generate_context!())
        .expect("failed to start Mind")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    let Ok(path) = url.to_file_path() else {
                        continue;
                    };
                    if let Some(state) = app.try_state::<AppState>() {
                        if let Ok(mut pending) = state.pending_open.lock() {
                            *pending = Some(path);
                        }
                    }
                    dispatch_menu(app, "open-pending");
                }
            }
        });
}
