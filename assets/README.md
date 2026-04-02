# Assets Directory Guide

This folder is split by purpose so runtime assets are easy to find.

## Runtime Paths

- `assets/skins/<skin-id>/`
  - In-game snake part textures (head/segment/tail).
  - Default skin is `assets/skins/classic-burrow/`.
- `assets/design-v5/manifest.json`
  - Active UI theme manifest (tool button slots).
- `assets/design-v5/clean/`
  - Files referenced by the v5 manifest.
- `assets/design-v3/clean/`
  - Home/panel/button/card fallback UI textures.
- `assets/design-v2/clean/`
  - Shared icon fallback textures used by home/settings/toolbar.

## Skin Generation / Template Source

- `assets/design-v4/clean/`
  - Canonical classic geometry/template source used by skin generation and fit tools.
  - Keep this folder as template baseline even if runtime skin paths point to `assets/skins/classic-burrow/`.

## Notes

- New generated skins are written to `assets/skins/<target-skin-id>/`.
- If adding a new playable skin, register it in `js/skins.js`.
