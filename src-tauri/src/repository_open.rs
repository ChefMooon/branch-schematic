use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenEditorRequest {
    pub executable_path: String,
    pub repository_path: String,
    pub target_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorDescriptor {
    pub id: String,
    pub label: String,
    pub executable_path: String,
    pub shell_command: Option<String>,
    pub folder_support: FolderSupport,
    pub source: EditorSource,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultEditorTarget {
    pub editor: EditorDescriptor,
    pub target_path: String,
}

#[derive(Clone, Debug, Serialize)]
pub enum FolderSupport {
    KnownSupported,
    KnownUnsupported,
    Unknown,
}

#[derive(Clone, Debug, Serialize)]
pub enum EditorSource {
    Known,
    Path,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryOpenError {
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryOpenResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<RepositoryOpenError>,
}

fn success<T>(data: T) -> RepositoryOpenResult<T> {
    RepositoryOpenResult {
        success: true,
        data: Some(data),
        error: None,
    }
}

fn failure<T>(code: &str, message: impl Into<String>) -> RepositoryOpenResult<T> {
    RepositoryOpenResult {
        success: false,
        data: None,
        error: Some(RepositoryOpenError {
            code: code.to_string(),
            message: message.into(),
        }),
    }
}

fn validate_repository_directory(path: &str) -> Result<PathBuf, RepositoryOpenError> {
    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        return Err(RepositoryOpenError {
            code: "invalid_repository_path".into(),
            message: "The repository path must be absolute.".into(),
        });
    }

    let canonical = candidate.canonicalize().map_err(|_| RepositoryOpenError {
        code: "repository_missing".into(),
        message: "The repository folder no longer exists.".into(),
    })?;
    if !canonical.is_dir() {
        return Err(RepositoryOpenError {
            code: "repository_not_directory".into(),
            message: "The repository path is not a folder.".into(),
        });
    }
    Ok(canonical)
}

fn validate_target_path(repository: &Path, target: &Path) -> Result<PathBuf, RepositoryOpenError> {
    let canonical = target.canonicalize().map_err(|_| RepositoryOpenError {
        code: "target_missing".into(),
        message: "The selected target no longer exists.".into(),
    })?;
    if !canonical.is_file() {
        return Err(RepositoryOpenError {
            code: "target_not_file".into(),
            message: "The selected target is not a regular file.".into(),
        });
    }
    if !canonical.starts_with(repository) {
        return Err(RepositoryOpenError {
            code: "target_outside_repository".into(),
            message: "The selected file must be inside the repository.".into(),
        });
    }
    Ok(canonical)
}

fn default_application_target(repository: &Path) -> PathBuf {
    repository.to_path_buf()
}

fn shell_command_for_editor_name(name: &str) -> Option<&'static str> {
    match name.to_ascii_lowercase().as_str() {
        "code" => Some("open-vscode"),
        "code-insiders" => Some("open-vscode-insiders"),
        "subl" => Some("open-sublime"),
        "sublime_text" => Some("open-sublime-text"),
        _ => None,
    }
}

#[cfg(windows)]
fn expand_windows_environment_variables(value: &str) -> String {
    let mut expanded = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(start) = remaining.find('%') {
        expanded.push_str(&remaining[..start]);
        let after_start = &remaining[start + 1..];
        let Some(end) = after_start.find('%') else {
            expanded.push_str(&remaining[start..]);
            return expanded;
        };
        let variable = &after_start[..end];
        if let Ok(replacement) = env::var(variable) {
            expanded.push_str(&replacement);
        } else {
            expanded.push('%');
            expanded.push_str(variable);
            expanded.push('%');
        }
        remaining = &after_start[end + 1..];
    }
    expanded.push_str(remaining);
    expanded
}

#[cfg(windows)]
fn windows_shell_default_editor() -> Option<(String, String)> {
    let association = Command::new("cmd.exe")
        .args(["/D", "/C", "assoc .txt"])
        .output()
        .ok()?;
    let association = String::from_utf8_lossy(&association.stdout);
    let prog_id = association
        .lines()
        .find_map(|line| line.trim().strip_prefix(".txt="))
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();

    let file_type = Command::new("cmd.exe")
        .args(["/D", "/C", "ftype"])
        .output()
        .ok()?;
    let file_type = String::from_utf8_lossy(&file_type.stdout);
    let command = file_type
        .lines()
        .find_map(|line| {
            let (name, command) = line.split_once('=')?;
            name.trim()
                .eq_ignore_ascii_case(&prog_id)
                .then_some(command.trim())
        })?
        .to_string();

    Some((prog_id, command))
}

#[cfg(windows)]
fn detect_default_editor() -> Result<EditorDescriptor, RepositoryOpenError> {
    use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER};
    use winreg::RegKey;

    let classes_root = RegKey::predef(HKEY_CLASSES_ROOT);
    let shell_association = windows_shell_default_editor();
    let prog_id = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.txt\UserChoice")
        .and_then(|key| key.get_value::<String, _>("ProgId"))
        .ok()
        .or_else(|| {
            classes_root
                .open_subkey(".txt")
                .and_then(|key| key.get_value::<String, _>(""))
                .ok()
        })
        .or_else(|| {
            shell_association
                .as_ref()
                .map(|(prog_id, _)| prog_id.clone())
        })
        .ok_or_else(|| RepositoryOpenError {
            code: "default_editor_unavailable".into(),
            message: "Windows does not have a default text editor configured.".into(),
        })?;

    let command = classes_root
        .open_subkey(format!(r"{prog_id}\shell\open\command"))
        .ok()
        .and_then(|key| key.get_value::<String, _>("").ok())
        .or_else(|| {
            shell_association
                .as_ref()
                .filter(|(shell_prog_id, _)| shell_prog_id.eq_ignore_ascii_case(&prog_id))
                .map(|(_, command)| command.clone())
        })
        .ok_or_else(|| RepositoryOpenError {
            code: "default_editor_unavailable".into(),
            message: "The default text editor command could not be resolved.".into(),
        })?;
    let executable_path = command
        .strip_prefix('"')
        .and_then(|value| value.split_once('"').map(|(path, _)| path.to_string()))
        .or_else(|| command.split_whitespace().next().map(str::to_string))
        .ok_or_else(|| RepositoryOpenError {
            code: "default_editor_unavailable".into(),
            message: "The default text editor executable could not be resolved.".into(),
        })?;
    let executable_path = expand_windows_environment_variables(&executable_path);
    let executable = PathBuf::from(&executable_path);
    if !executable.is_file() {
        return Err(RepositoryOpenError {
            code: "default_editor_missing".into(),
            message: "The configured default text editor is no longer installed.".into(),
        });
    }

    let registry_label = classes_root
        .open_subkey(&prog_id)
        .and_then(|key: RegKey| key.get_value::<String, _>(""))
        .unwrap_or_default();
    let executable_name = executable
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let shell_command = shell_command_for_editor_name(&executable_name).map(str::to_string);
    let label = match executable_name.as_str() {
        "code" => "Visual Studio Code".to_string(),
        "code-insiders" => "VS Code Insiders".to_string(),
        "cursor" => "Cursor".to_string(),
        "subl" | "sublime_text" => "Sublime Text".to_string(),
        "notepad++" | "notepad-plus-plus" => "Notepad++".to_string(),
        "notepad" => "Notepad".to_string(),
        _ if !registry_label.trim().is_empty() => registry_label,
        _ => prog_id.clone(),
    };

    Ok(EditorDescriptor {
        id: format!("windows:{prog_id}"),
        label,
        executable_path,
        shell_command,
        folder_support: FolderSupport::Unknown,
        source: EditorSource::Known,
    })
}

#[cfg(target_os = "macos")]
fn detect_default_editor() -> Result<EditorDescriptor, RepositoryOpenError> {
    let executable = command_exists("open").ok_or_else(|| RepositoryOpenError {
        code: "default_editor_unavailable".into(),
        message: "The macOS default text editor command could not be resolved.".into(),
    })?;
    Ok(EditorDescriptor {
        id: "macos:default-text-editor".into(),
        label: "Default text editor".into(),
        executable_path: executable.to_string_lossy().into_owned(),
        shell_command: None,
        folder_support: FolderSupport::KnownUnsupported,
        source: EditorSource::Known,
    })
}

#[cfg(target_os = "linux")]
fn detect_default_editor() -> Result<EditorDescriptor, RepositoryOpenError> {
    let executable = command_exists("xdg-open").ok_or_else(|| RepositoryOpenError {
        code: "default_editor_unavailable".into(),
        message: "The Linux default text editor command could not be resolved.".into(),
    })?;
    Ok(EditorDescriptor {
        id: "linux:default-text-editor".into(),
        label: "Default text editor".into(),
        executable_path: executable.to_string_lossy().into_owned(),
        shell_command: None,
        folder_support: FolderSupport::KnownUnsupported,
        source: EditorSource::Known,
    })
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn detect_default_editor() -> Result<EditorDescriptor, RepositoryOpenError> {
    Err(RepositoryOpenError {
        code: "default_editor_unavailable".into(),
        message: "Resolving the system default text editor is not supported on this platform."
            .into(),
    })
}

fn find_default_editor_target(
    repository: &Path,
) -> Result<DefaultEditorTarget, RepositoryOpenError> {
    let mut editor = detect_default_editor()?;
    if matches!(editor.folder_support, FolderSupport::Unknown) {
        editor.folder_support = known_editor_candidates()
            .into_iter()
            .find(|(_, label, _, _)| label.eq_ignore_ascii_case(&editor.label))
            .map(|(_, _, _, support)| support)
            .unwrap_or(FolderSupport::KnownUnsupported);
    }
    let target_path = if matches!(editor.folder_support, FolderSupport::KnownSupported) {
        repository.to_path_buf()
    } else {
        find_repository_text_file(repository).ok_or_else(|| RepositoryOpenError {
            code: "repository_text_file_unavailable".into(),
            message: "No text file was found in the repository for the default editor.".into(),
        })?
    };
    Ok(DefaultEditorTarget {
        editor,
        target_path: target_path.to_string_lossy().into_owned(),
    })
}

fn find_repository_text_file(repository: &Path) -> Option<PathBuf> {
    const PREFERRED_FILES: &[&str] = &["README.md", "README.txt", "Cargo.toml", "package.json"];
    for name in PREFERRED_FILES {
        let candidate = repository.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    let entries = std::fs::read_dir(repository).ok()?;
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && matches!(
                    path.extension().and_then(|extension| extension.to_str()),
                    Some(
                        "txt"
                            | "md"
                            | "markdown"
                            | "json"
                            | "toml"
                            | "rs"
                            | "ts"
                            | "tsx"
                            | "js"
                            | "jsx"
                            | "css"
                            | "html"
                    )
                )
        })
}

fn command_exists(command_name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for directory in env::split_paths(&path_var) {
        #[cfg(windows)]
        {
            for extension in [".exe", ".cmd", ".bat", ""] {
                let candidate = directory.join(format!("{command_name}{extension}"));
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
        #[cfg(not(windows))]
        {
            let candidate = directory.join(command_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(windows)]
fn installed_editor_path(editor_id: &str) -> Option<PathBuf> {
    let roots = [
        env::var_os("ProgramFiles").map(PathBuf::from),
        env::var_os("ProgramFiles(x86)").map(PathBuf::from),
        env::var_os("LOCALAPPDATA").map(PathBuf::from),
    ];
    let relative_paths: &[&str] = match editor_id {
        "sublime" => &[
            r"Sublime Text\sublime_text.exe",
            r"Sublime Text Build\sublime_text.exe",
        ],
        _ => &[],
    };

    roots
        .into_iter()
        .flatten()
        .flat_map(|root| {
            relative_paths
                .iter()
                .map(move |relative| root.join(relative))
        })
        .find(|path| path.is_file())
}

#[cfg(not(windows))]
fn installed_editor_path(_editor_id: &str) -> Option<PathBuf> {
    None
}

#[cfg(windows)]
fn windows_terminal_launch_args(repository: &Path) -> Vec<String> {
    let repository = repository.to_string_lossy();
    let repository = if let Some(path) = repository.strip_prefix("\\\\?\\UNC\\") {
        format!("\\\\{path}")
    } else {
        repository
            .strip_prefix("\\\\?\\")
            .unwrap_or(&repository)
            .to_string()
    };

    vec!["-d".to_string(), repository]
}

fn known_editor_candidates() -> Vec<(
    &'static str,
    &'static str,
    &'static [&'static str],
    FolderSupport,
)> {
    vec![
        (
            "vscode",
            "Visual Studio Code",
            &["code"],
            FolderSupport::KnownSupported,
        ),
        (
            "vscode-insiders",
            "VS Code Insiders",
            &["code-insiders"],
            FolderSupport::KnownSupported,
        ),
        (
            "cursor",
            "Cursor",
            &["cursor"],
            FolderSupport::KnownSupported,
        ),
        (
            "sublime",
            "Sublime Text",
            &["subl", "sublime_text"],
            FolderSupport::KnownSupported,
        ),
        (
            "notepad-plus-plus",
            "Notepad++",
            &["notepad++", "notepad-plus-plus"],
            FolderSupport::KnownUnsupported,
        ),
        (
            "jetbrains",
            "JetBrains IDE",
            &["idea", "idea64", "webstorm", "pycharm", "rider"],
            FolderSupport::KnownSupported,
        ),
    ]
}

fn deduplicate_editors(editors: Vec<EditorDescriptor>) -> Vec<EditorDescriptor> {
    let mut result = Vec::new();
    for editor in editors {
        if result.iter().any(|item: &EditorDescriptor| {
            item.executable_path
                .eq_ignore_ascii_case(&editor.executable_path)
        }) {
            continue;
        }
        result.push(editor);
    }
    result.sort_by(|left, right| {
        left.label
            .cmp(&right.label)
            .then(left.executable_path.cmp(&right.executable_path))
    });
    result
}

#[tauri::command]
pub fn detect_repository_editors() -> RepositoryOpenResult<Vec<EditorDescriptor>> {
    let mut editors = Vec::new();
    for (id, label, commands, folder_support) in known_editor_candidates() {
        for command_name in commands {
            if let Some(path) = command_exists(command_name).or_else(|| installed_editor_path(id)) {
                editors.push(EditorDescriptor {
                    id: id.to_string(),
                    label: label.to_string(),
                    executable_path: path.to_string_lossy().into_owned(),
                    shell_command: shell_command_for_editor_name(command_name).map(str::to_string),
                    folder_support: folder_support.clone(),
                    source: EditorSource::Known,
                });
                break;
            }
        }
    }
    success(deduplicate_editors(editors))
}

#[tauri::command]
pub fn resolve_default_application_target(repository_path: String) -> RepositoryOpenResult<String> {
    let repository = match validate_repository_directory(&repository_path) {
        Ok(path) => path,
        Err(error) => return failure(&error.code, error.message),
    };
    success(
        default_application_target(&repository)
            .to_string_lossy()
            .into_owned(),
    )
}

#[tauri::command]
pub fn resolve_default_editor(
    repository_path: String,
) -> RepositoryOpenResult<DefaultEditorTarget> {
    let repository = match validate_repository_directory(&repository_path) {
        Ok(path) => path,
        Err(error) => return failure(&error.code, error.message),
    };
    match find_default_editor_target(&repository) {
        Ok(target) => success(target),
        Err(error) => failure(&error.code, error.message),
    }
}

#[tauri::command]
pub fn launch_repository_file_explorer(repository_path: String) -> RepositoryOpenResult<()> {
    let repository = match validate_repository_directory(&repository_path) {
        Ok(path) => path,
        Err(error) => return failure(&error.code, error.message),
    };

    #[cfg(windows)]
    let launch = env::var_os("WINDIR")
        .map(PathBuf::from)
        .map(|windows| windows.join("explorer.exe"))
        .filter(|path| path.is_file())
        .or_else(|| command_exists("explorer.exe"))
        .map(|path| {
            let repository = repository.to_string_lossy();
            let repository = repository
                .strip_prefix("\\\\?\\UNC\\")
                .map(|path| format!("\\\\{path}"))
                .or_else(|| repository.strip_prefix("\\\\?\\").map(str::to_string))
                .unwrap_or_else(|| repository.to_string());
            (path, vec![repository])
        });
    #[cfg(target_os = "macos")]
    let launch =
        command_exists("open").map(|path| (path, vec![repository.to_string_lossy().into_owned()]));
    #[cfg(target_os = "linux")]
    let launch = command_exists("xdg-open")
        .map(|path| (path, vec![repository.to_string_lossy().into_owned()]));
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    let launch: Option<(PathBuf, Vec<String>)> = None;

    let Some((executable, args)) = launch else {
        return failure(
            "file_explorer_unavailable",
            "No supported file explorer was found.",
        );
    };

    Command::new(executable)
        .args(args)
        .spawn()
        .map(|_| success(()))
        .unwrap_or_else(|error| {
            failure(
                "file_explorer_launch_failed",
                format!("Could not open the file explorer: {error}"),
            )
        })
}

#[tauri::command]
pub fn launch_repository_terminal(repository_path: String) -> RepositoryOpenResult<()> {
    let repository = match validate_repository_directory(&repository_path) {
        Ok(path) => path,
        Err(error) => return failure(&error.code, error.message),
    };

    #[cfg(windows)]
    let launch = command_exists("wt")
        .map(|path| (path, windows_terminal_launch_args(&repository)))
        .or_else(|| command_exists("cmd").map(|path| (path, vec!["/K".to_string()])));
    #[cfg(target_os = "macos")]
    let launch = command_exists("open").map(|path| {
        (
            path,
            vec![
                "-a".to_string(),
                "Terminal".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        )
    });
    #[cfg(all(unix, not(target_os = "macos")))]
    let launch = [
        (
            "x-terminal-emulator",
            vec![
                "--working-directory".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        ),
        (
            "gnome-terminal",
            vec![
                "--working-directory".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        ),
        (
            "konsole",
            vec![
                "--workdir".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        ),
        (
            "kitty",
            vec![
                "--directory".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        ),
        (
            "alacritty",
            vec![
                "--working-directory".to_string(),
                repository.to_string_lossy().into_owned(),
            ],
        ),
    ]
    .into_iter()
    .find_map(|(name, args)| command_exists(name).map(|path| (path, args)));

    let Some((executable, args)) = launch else {
        return failure(
            "terminal_unavailable",
            "No supported terminal application was found.",
        );
    };

    let mut command = Command::new(executable);
    command.args(args);
    #[cfg(any(windows, all(unix, not(target_os = "macos"))))]
    command.current_dir(repository);
    command
        .spawn()
        .map(|_| success(()))
        .unwrap_or_else(|error| {
            failure(
                "terminal_launch_failed",
                format!("Could not open the terminal: {error}"),
            )
        })
}

#[tauri::command]
pub fn launch_repository_editor(request: OpenEditorRequest) -> RepositoryOpenResult<()> {
    let repository = match validate_repository_directory(&request.repository_path) {
        Ok(path) => path,
        Err(error) => return failure(&error.code, error.message),
    };
    let executable = PathBuf::from(&request.executable_path);
    if !executable.is_absolute() || !executable.is_file() {
        return failure(
            "editor_missing",
            "The selected editor executable no longer exists.",
        );
    }

    let target = match request.target_path {
        Some(path) => match validate_target_path(&repository, Path::new(&path)) {
            Ok(path) => path,
            Err(error) => return failure(&error.code, error.message),
        },
        None => repository.clone(),
    };

    let mut command = Command::new(&executable);
    #[cfg(windows)]
    if matches!(
        executable
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.eq_ignore_ascii_case("cmd")
                || extension.eq_ignore_ascii_case("bat")),
        Some(true)
    ) {
        // VS Code's Windows launcher is a batch file. CreateProcess cannot run
        // batch files directly, so route them through the Windows command shell.
        command = Command::new("cmd.exe");
        command.args(["/D", "/C"]).arg(&executable);
    }
    command
        .arg(target)
        .spawn()
        .map(|_| success(()))
        .unwrap_or_else(|error| {
            failure(
                "editor_launch_failed",
                format!("Could not open the editor: {error}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rejects_files_outside_repository() {
        let repository = tempdir().expect("repository tempdir");
        let outside = tempdir().expect("outside tempdir");
        let file = outside.path().join("outside.txt");
        std::fs::write(&file, "outside").expect("outside file");

        let error =
            validate_target_path(repository.path(), &file).expect_err("outside file should fail");
        assert_eq!(error.code, "target_outside_repository");
    }

    #[test]
    fn discovers_only_existing_path_launchers() {
        let editors = deduplicate_editors(vec![
            EditorDescriptor {
                id: "test".into(),
                label: "Test".into(),
                executable_path: "a".into(),
                shell_command: None,
                folder_support: FolderSupport::Unknown,
                source: EditorSource::Path,
            },
            EditorDescriptor {
                id: "test".into(),
                label: "Test".into(),
                executable_path: "a".into(),
                shell_command: None,
                folder_support: FolderSupport::Unknown,
                source: EditorSource::Path,
            },
        ]);
        assert_eq!(editors.len(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn windows_terminal_launch_args_preserve_repository_paths() {
        let repository = Path::new(r"\\?\C:\Users\justi\Documents\Repository With Spaces");

        assert_eq!(
            windows_terminal_launch_args(repository),
            vec!["-d", r"C:\Users\justi\Documents\Repository With Spaces"]
        );

        let unc_repository = Path::new(r"\\?\UNC\server\share\Repository With Spaces");

        assert_eq!(
            windows_terminal_launch_args(unc_repository),
            vec!["-d", r"\\server\share\Repository With Spaces"]
        );
    }
}
