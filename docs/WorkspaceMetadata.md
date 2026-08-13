# Workspace metadata backup

Branch Schematic stores repository catalog information in a SQLite database under the user's application-data directory. On Windows release builds, the path is:

`%APPDATA%\com.justi.branch-schematic\branch-schematic.db`

Debug builds use `branch-schematic-dev.db` in the same directory. On supported platforms, the runtime uses the configured application-data directory; if `APPDATA` is unavailable, the current working directory is used as a fallback. Other platforms may use a different database filename. This location is separate from the installed program files, so a normal application update or uninstall should not remove it. A cleanup utility, profile reset, or explicit deletion of application data can still remove the database. Use the **Export** action in Data Management before reinstalling if the data must be recoverable in those situations.

## Export and import

The **Backup & Transfer** section in Settings is the user-facing entry point for versioned JSON application exports. Data Management remains focused on tags, groups, and archived repositories.

The Data Management dialog can export a versioned JSON file and import it later. The export contains:

- tracked repository paths, display names, aliases, remote URLs, active/archive state, group assignment, favorite/pinned state, theme color, and icon;
- custom groups and their colors;
- global tags and their colors;
- repository-to-tag assignments.

The application export also includes canvas views, viewport settings, repository card positions, visibility, manual edges, theme, and the detail status refresh interval. Authentication profiles, access tokens, cached Git branches/commits, notifications, window state, startup preferences, and other machine-specific settings are not exported. Branch-cache-specific layout records are excluded because cache IDs are local to each installation.

Application exports contain the current workspace only: active repositories and non-archived canvas views. Archived repositories and inactive repository layout records are excluded. The standalone workspace metadata export retains its existing metadata scope for compatibility.

Authentication profiles, access tokens, cached Git branches/commits, canvas caches, notifications, and operating-system preferences are not exported. Tokens remain in the OS keyring and are never written to the metadata file.

Import accepts both the new application export and the existing version-1 workspace metadata format. Existing repositories are matched by absolute path, while groups and tags are matched case-insensitively by name. Existing records are updated with imported metadata, and missing records are created. Repositories whose folders are unavailable are moved to Archive and returned as recovery items. They are not monitored until relinked; successful relinking restores them to the active workspace. A destructive replace-all restore is not supported.

Application import restores repository cards, explicit repository visibility, and manual edges for active canvas views. Archived views found in older application exports are skipped and reported as import diagnostics. The import summary counts records processed, not only newly created records.

If a repository is inactive but missing from Archive, open Data Management and use **Repair records** in the Archived repositories tab. This moves hidden inactive records into Archive without deleting them. The repair is safe to repeat.

## Reinstall recovery workflow

1. Before uninstalling, open Settings and choose **Export** in Backup & Transfer.
2. Save the JSON file somewhere outside the application-data directory.
3. Uninstall and reinstall Branch Schematic.
4. Open Settings, choose **Import** in Backup & Transfer, and select the saved JSON file.
5. Relink any repository folders that were unavailable during import.

This backup is intentionally user-controlled rather than silently uploaded or copied elsewhere. Keep exports private because repository paths and remote URLs may reveal project information.
