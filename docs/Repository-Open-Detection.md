# Repository Open and Editor Detection

Branch Schematic provides three repository-opening options:

- **Open in File Explorer** opens the repository in the platform's file manager.
- **Open in terminal** starts a supported terminal with the repository as its working directory.
- **Open in the detected editor** uses the operating system's default text editor association.
- **Open with...** detects known editors or lets the user browse for an executable.

All editor launches are routed through the Rust `repository_open` command. The
command validates the repository, validates any selected file, and validates
that the editor executable still exists before spawning it.

## File Explorer

The **Open in File Explorer** action appears before **Open in terminal**.
It validates that the tracked repository still exists and opens the folder
using the platform-native file manager:

| Platform | Launcher |
| --- | --- |
| Windows | `explorer.exe` |
| macOS | `/usr/bin/open` |
| Linux | `xdg-open` |

Windows extended-length paths are normalized before being passed to
`explorer.exe`. If the platform launcher is unavailable or fails to start, the
repository action notification reports the failure.

## Known editor detection

Known editors are detected from executable commands on `PATH`. On Windows,
`.exe`, `.cmd`, and `.bat` variants are searched. Sublime Text also has a
Windows installation-path fallback because its `subl` command is commonly not
added to `PATH`.

| Editor | Commands searched | Folder support | Launch target |
| --- | --- | --- | --- |
| Visual Studio Code | `code` | Supported | Repository folder |
| VS Code Insiders | `code-insiders` | Supported | Repository folder |
| Cursor | `cursor` | Supported | Repository folder |
| Sublime Text | `subl`, `sublime_text`; common Windows install paths | Supported | Repository folder |
| Notepad++ | `notepad++`, `notepad-plus-plus` | Unsupported | Selected repository text file |
| JetBrains IDEs | `idea`, `idea64`, `webstorm`, `pycharm`, `rider` | Supported | Repository folder |

Detection returns the first available command for each editor and removes
duplicates by executable path. The list is sorted by editor label.

## Open with...

The **Open with...** modal loads the known-editor list when opened.

### Selecting a known editor

For editors marked as folder-supported, the repository directory is passed
directly to the executable.

For editors that do not support folders, the app first chooses a default
repository text file (`README.md`, `README.txt`, `Cargo.toml`, or
`package.json`). If none is available, the user is prompted to choose a file
inside the repository.

### Browse for an executable

**Browse for an executable** uses the native file picker and adds the selected
absolute path as a custom editor. Custom editors have unknown folder support,
so the app asks for a repository file before launching them. This is safe for
editors such as Notepad that cannot open directories.

Custom `.exe` files are launched directly. On Windows, `.cmd` and `.bat`
files are routed through `cmd.exe`, which is required for batch launchers such
as the VS Code command-line scripts.

## Default text editor

The default-editor action resolves the application associated with `.txt`
files and changes its label when detection succeeds.

### Windows

Resolution attempts the following:

1. The user's `.txt` `UserChoice` registry association.
2. The merged `HKEY_CLASSES_ROOT` `.txt` association.
3. Windows `assoc .txt` and `ftype` command output as a fallback.

The registered command is parsed to obtain its executable, environment
variables are expanded, and the executable must exist before it is accepted.
The resolved editor opens a repository text file because the default text
editor cannot be assumed to support folders.

### macOS

The app uses `/usr/bin/open` with a repository text file. macOS resolves the
file's associated default application.

### Linux

The app uses `xdg-open` with a repository text file. The desktop environment
resolves the associated default application.

### When no default editor is detected

The default-editor action is disabled and labeled **Default editor
unavailable**. Use **Open with...** to select a detected or custom editor.

> **Known issue:** Windows default text-editor detection is currently
> unreliable in some packaged environments and requires follow-up work.

## Launch and error handling

Editor paths are passed as process arguments rather than concatenated shell
strings. Repository and target paths are canonicalized and checked so a
selected file must remain inside the tracked repository. Launch failures are
reported to the repository action notification.

The Tauri shell plugin command aliases remain configured for other application
features, but editor launching does not depend on shell aliases. This avoids
desktop `PATH` differences and supports Windows batch launchers consistently.
