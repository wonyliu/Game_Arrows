# Assets Directory Guide

This folder is split by purpose so runtime assets are easy to find.

## Runtime Paths

- `assets/skins/<skin-id>/`
  - In-game snake part textures (head/segment/tail).
  - Default skin is `assets/skins/classic-burrow/`.
- `assets/skins/templates/classic-clean/`
  - Canonical classic geometry/template source used by skin generation and fit tools.
- `assets/ui/home/`
  - Home screen shared panels, button shells, and background art.
- `assets/ui/settings/`
  - Settings-specific concept and screen assets.
- `assets/ui/checkin/`
  - Check-in page runtime textures and manifest.
- `assets/ui/rewards/`
  - Reward / unlock banner assets.
- `assets/ui/shared/icons/`
  - Shared runtime icons used by toolbar, menus, rewards, and avatar fallbacks.
- `assets/ui/shared/components/`
  - Shared decorative UI parts such as card/button shells.
- `assets/ui/themes/design-v5/`
  - Active UI theme manifest, KB files, and tool button assets.

## Notes

- New generated skins are written to `assets/skins/<target-skin-id>/`.
- If adding a new playable skin, register it in `js/skins.js`.
