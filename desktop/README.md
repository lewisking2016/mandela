# MANDELA Desktop App — Tauri 2

**Surfaces:** admin office, bursar, principal — the keyboard-and-printer crowd.

## Why Tauri (locked by architecture research)
- **~3 MB binaries vs Electron's ~150 MB** — decisive for schools on slow
  connections; 50–100 MB RAM vs ~300 MB.
- Rust core handles the desktop-only jobs: **report-card/receipt printing
  (including thermal printers)**, background PowerSync, auto-update.
- Renders the **same web UI package** (`frontend/packages/ui`) inside a native
  window — no second UI codebase.

## Stack
- **Tauri 2** (capability-based security; sidecar-free)
- **Frontend:** the Next.js web bundle pointed at the school API
  (shared `@mandela/ui` design system, Tailwind preset, RoleShell)
- **Rust plugins:** `tauri-plugin-printer` (reports/receipts), updater,
  single-instance

## Screens (priority)
| Role | Screens |
|---|---|
| Bursar | Today, Collect, Reconcile, Levies, Reports + printing |
| Admin | Today, People, Money, Insights, Settings + KEMIS exports |
| Principal | Today, Approve, Insights, Broadcast, Directory |

## Packaging
- MSI (Windows — school offices), DMG (macOS), AppImage/deb (Linux).
- Auto-updater wired to the backend release feed; installs stay under 10 MB.
