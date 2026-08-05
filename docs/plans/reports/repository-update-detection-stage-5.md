# Repository Update Detection: Stage 5 Evidence

## Scope

Stage 5 adds the IPC invalidation contract and frontend synchronization for managed watcher refreshes. The legacy watcher path remains available during the transition.

## Implemented

- Managed refreshes emit version 1 `workspace-updated` events only after a successful cache commit and while the repository generation is still current.
- Event payloads use camelCase fields and are bounded to 250 repository IDs per batch.
- Each event has a process-local revision and unique batch event ID.
- The workspace store owns one shared Tauri listener across `AppLayout` subscribers.
- Malformed payloads, duplicate repository revisions, and revision gaps are handled without applying event payloads as authoritative repository data.
- Accepted invalidations rehydrate tracked repositories and canvas nodes from backend data.
- Async listener registration cleans itself up when the final subscriber releases before registration completes.
- Repository update documentation now describes legacy and managed transition modes.

## Validation

| Check | Result |
| --- | --- |
| Focused workspace synchronization tests | Pass: 2 tests |
| Focused AppLayout plus synchronization tests | Pass: 7 tests |
| Full frontend suite (`npm test`) | Pass: 30 files, 107 tests |
| Frontend production build (`npm run build`) | Pass; existing Vite large-chunk warning remains |
| Rust formatting (`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`) | Pass |
| Rust test compilation (`cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`) | Pass |
| Rust test execution (`cargo test --manifest-path src-tauri/Cargo.toml`) | Blocked after compilation by Windows `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) when launching the test executable |

## Remaining Verification Risk

- Managed-mode desktop verification was not run in this environment. It should confirm that a local Git change produces one refresh and one invalidation sequence, that the UI rehydrates, and that the legacy mode still starts its daemon and polling behavior.
- The Rust assertions could not execute because the Windows test binary failed to launch; this is a harness/runtime dependency issue rather than a reported test assertion failure.
- A real multi-repository burst should be exercised manually to confirm batching and event ordering across repositories.

## Conclusion

Stage 5 implementation is complete with passing frontend validation, passing Rust compilation and formatting, and an explicit Windows test-runner limitation. It is not fully runtime-validated until the Rust test executable can launch and managed-mode desktop checks are performed.
