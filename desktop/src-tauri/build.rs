fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "bootstrap",
                "save_mind_map",
                "save_config",
                "save_lang",
                "save_local_config",
                "new_file",
                "open_file",
                "save_file_as",
                "reveal_documents",
                "take_pending_open",
                "boot_log",
                "ai_config_status",
                "reveal_ai_config",
                "ai_complete",
            ]),
        ),
    )
    .expect("failed to run tauri build");
}
