# Reactive first-sync readiness

Implements Master `messages/20261011T1400Z-master-rooms-wait-for-sync.md` using the existing host runtime. The installed declaration defines SyncStatus.lastCompleted as string | null; null is initial incomplete synchronization. No package or protocol is patched.

- Observe both Rooms and Sync Status continuously. Before first completed sync, show Loading without declaring a missing binding. Start typed reads only when the latest Room list has exactly one bound Room and lastCompleted is a string.
- Completed missing/multiple Room reach fails closed and clears when the original sole binding returns. Close stale query observers; late async setup/results cannot repopulate a lost reach.
- Preserve open edits through temporary reach loss; prevent new provider reads/writes while unavailable. Exact draft/write/save guards recheck availability at asynchronous boundaries and never discard already prepared House drafts. A different replacement locator does not silently move an existing editor to another Room.
- Existing refusal, write-halt, returned-draft and storage-loss warnings stay. No generic Room picker, permanent sync strip, guessed locator, content fallback, permission expansion, sandbox change, or new external resource.

Tests cover initial empty Room list with incomplete sync, both event orders, completed zero/multiple Rooms, delayed valid reach, temporary loss/recovery and unsaved-state preservation, plus rejected writes and stale observation cleanup. These are local checks, not hosted acceptance.

## Architecture boundary

The donor React-admin renderer still consumes async DataProvider methods and React Query loading/cache behavior. Those reads query the House device-local replica, never a REST endpoint, and House observations invalidate them. This startup repair does not claim to remove the per-route async loading lifecycle or to persist every unsubmitted form value as a House draft. The user’s broader local-first navigation/editor architecture awaits Master’s detailed adaptation contract.

The release3 opaque-origin storage-probe fix is preserved. Tests still evaluate the real bundle with both storage getters throwing; no allow-same-origin or storage shim is added.
