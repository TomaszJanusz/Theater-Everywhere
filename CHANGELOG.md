# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Shadow DOM traversal to discover video players inside shadow roots.
- Custom glassmorphic tooltips with keyboard shortcut hints on control buttons.
- New icon design with active/disabled states and youtube.com as a default exclusion.
- Vertical pop-up sliders for volume and speed controls replacing the inline horizontal sliders.
- Customizable keyboard shortcuts: Volume Up (`ArrowUp`), Volume Down (`ArrowDown`), Toggle PiP (`P`), Show/Hide Help (`H`).
- macOS/iOS-style volume HUD overlay with dynamic speaker icons and directional zoom-in/zoom-out text animations.
- Unified glassmorphic seek overlays matching the volume HUD visual style.

### Changed
- Website exclusions redesigned from tag/badge cloud to a compact vertical domain list.
- Default frame step shortcuts changed from `N`/`M` to `<`/`>`.
- Migrated from npm to pnpm.
- UI overlay and loading indicator appended to `document.body` for layout isolation.

### Fixed
- Mozilla Addons (AMO) validator errors and warnings resolved.
- Security, compatibility, and store compliance issues addressed.
- Player controls, slider styling, www-domain matching, and CI versioning.
- Content script shortcut initialization mapping for new shortcuts.
- CSS `!important` removed from `@keyframes` declarations (browsers ignore it per spec).

## [1.0.0] - 2026-06-29

Initial public release of Theater Everywhere.

### Added
- Core theater mode: maximize any HTML5 video to fill the browser viewport with a single keypress (`T`).
- Multi-video cycling with `Shift+T` to switch between videos on a page.
- Full player controls overlay: play/pause, seek bar with buffering indicator, loading spinner, volume and speed sliders.
- Subtitle support with native `textTracks` selection and custom cue styling.
- Configurable keyboard shortcuts with options page and per-key reset buttons.
- Website blacklist to disable the extension on specific domains.
- Dynamic system AccentColor integration for theming.
- ArrowLeft/ArrowRight seek with animated YouTube-style visual overlay indicators.
- Frame-stepping with `N`/`M` keys.
- Fullscreen toggle with `F` key.
- Play/Pause with `Space` key.
- GitHub Actions CI workflow for automated builds and tagged releases.
- Chrome and Firefox extension packaging (MV3).
