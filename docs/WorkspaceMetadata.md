# Workspace metadata backup

Branch Schematic stores repository catalog information in a SQLite database under the user's application-data directory. On Windows release builds, the path is:

`%APPDATA%\com.justi.branch-schematic\branch-schematic.db`

Debug builds use `branch-schematic-dev.db` in the same directory. On supported platforms, the runtime uses the configured application-data directory; if `APPDATA` is unavailable, the current working directory is used as a fallback. Other platforms may use a different database filename. This location is separate from the installed program files, so a normal application update or uninstall should not remove it. A cleanup utility, profile reset, or explicit deletion of application data can still remove the database. Use the **Export** action in Data Management before reinstalling if the data must be recoverable in those situations.

## Export and import

The Data Management dialog can export a versioned JSON file and import it later. The export contains:

- tracked repository paths, display names, aliases, remote URLs, active/archive state, group assignment, favorite/pinned state, theme color, and icon;
- custom groups and their colors;
- global tags and their colors;
- repository-to-tag assignments.

Authentication profiles, access tokens, cached Git branches/commits, canvas caches, notifications, and operating-system preferences are not exported. Tokens remain in the OS keyring and are never written to the metadata file.

Import is transactional: an invalid or unsupported file does not partially modify the database. Existing repositories are matched by absolute path, while groups and tags are matched case-insensitively by name. Existing records are updated with the imported display and color metadata, and missing records are created. Relationships are restored only when both referenced records are valid. Repositories whose folders are currently unavailable may be restored as archived or inactive metadata and can be reactivated after the folder is available.

## Reinstall recovery workflow

1. Before uninstalling, open Data Management and choose **Export**.
2. Save the JSON file somewhere outside the application-data directory.
3. Uninstall and reinstall Branch Schematic.
4. Open Data Management, choose **Import**, and select the saved JSON file.
5. Re-add or restore any repository folders that were unavailable during import.

This backup is intentionally user-controlled rather than silently uploaded or copied elsewhere. Keep exports private because repository paths and remote URLs may reveal project information.
