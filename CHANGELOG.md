# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [.1.2.0] - 2026-07-09

### Added
- Localized extension UI and manifest metadata for English, Spanish, Simplified Chinese, German, and Polish using WebExtensions `_locales`.
- Paste-ready Chrome Web Store and AMO store listing copy for all supported locales.
- Release helper workflow for ensuring a requested version has a GitHub Release.
- Optional AMO, Chrome Web Store, and Microsoft Edge Add-ons publishing steps for release builds.
- Store publishing setup documentation and helper scripts for Chrome Web Store and Microsoft Edge Add-ons APIs.

### Changed
- Popup, options, and theater overlay text now use shared localization helpers and browser-selected language.
- Build packaging now copies `_locales` into Chrome and Firefox release artifacts.
- Local macOS, editor, and browser extension build artifacts are ignored by Git.

## [1.1.0] - 2026-07-02

Completely redesigned controls experience — volume and speed now live in vertical pop-up panels that appear on hover, the in-player help overlay groups shortcuts just like the settings page, and a new volume/playback HUD gives instant visual feedback when adjusting volume or toggling play/pause with keyboard shortcuts. Volume can now be boosted up to 300% using the Web Audio API with a non-linear slider design prioritizing the 0-100% range, controlled by a new feature toggle in the options panel to enable or disable it. On pages with multiple videos, the extension automatically picks the best candidate based on visibility, playback state, and size — and you can cycle between them with a single shortcut. Fullscreen transitions now automatically resume playback if the site's scripts pause the video during transition. The extension also works on more sites thanks to Shadow DOM support, and the overall look has been refined with glassmorphic tooltips and seek overlays.

### Added
- Shadow DOM traversal to discover video players inside shadow roots.
- Custom glassmorphic tooltips with keyboard shortcut hints on control buttons.
- New icon design with active/disabled states and youtube.com as a default exclusion.
- Vertical pop-up sliders for volume and speed controls replacing the inline horizontal sliders.
- Volume Boost option allowing users to amplify volume up to 300% using the Web Audio API, mapped non-linearly to the top 1/3 of the slider track.
- Volume Boost feature toggle switch in the options page to enable/disable the feature.
- Customizable keyboard shortcuts: Volume Up (`ArrowUp`), Volume Down (`ArrowDown`), Toggle PiP (`P`), Show/Hide Help (`H`).
- macOS/iOS-style volume HUD overlay with dynamic speaker icons and directional zoom-in/zoom-out text animations.
- Play and Pause HUD overlay notifications when using keyboard shortcuts to toggle playback.
- Unified glassmorphic seek overlays matching the volume HUD visual style.
- Help overlay now organized into the same shortcut groups as the settings page.

### Changed
- Website exclusions redesigned from tag/badge cloud to a compact vertical domain list.
- Default frame step shortcuts changed from `N`/`M` to `<`/`>`.
- Migrated from npm to pnpm.
- UI overlay and loading indicator appended to `document.body` for layout isolation.
- `Escape` key now closes the help overlay first instead of exiting theater mode when help is open.

### Fixed
- Mozilla Addons (AMO) validator errors and warnings resolved.
- Security, compatibility, and store compliance issues addressed.
- Player controls, slider styling, www-domain matching, and CI versioning.
- Content script shortcut initialization mapping for new shortcuts.
- CSS `!important` removed from `@keyframes` declarations (browsers ignore it per spec).
- Playback pausing when entering/exiting fullscreen on pages containing multiple video elements.

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
