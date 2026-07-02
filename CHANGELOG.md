# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Placeholder for upcoming features in development.

## [1.0.0] - 2026-07-02

### Added
- **Vertical Pop-up Sliders**: Replaced horizontal volume and video speed ranges with sleek, vertical pop-up panels appearing above toolbar buttons.
  - Features focus blur dismissing, a sticky bridge element to prevent hover loss, and overlapping tooltip hiding.
  - Click hitboxes expanded to 24px width while keeping the track visually thin (4px) using transparent range borders.
- **Customizable Key Shortcuts**: Added interface and settings mapping for 4 new default keyboard shortcuts:
  - Volume Up (`ArrowUp` to raise volume by 5%)
  - Volume Down (`ArrowDown` to lower volume by 5%)
  - Toggle Picture-in-Picture (`P`)
  - Toggle Keyboard Help Modal (`H`)
- **iOS/macOS-style Volume HUD**: Centered horizontal overlay displaying volume percentages and dynamic speaker icons on volume changes.
  - Refined to display at the top of the video (`top: 10%`) with high transparency (`rgba(15, 15, 15, 0.5)` with `backdrop-filter: blur(16px)`).
  - Implemented 3-step scale-bounce zoom animations (zoom-in on volume up, zoom-out on volume down) isolated on the inner content text/icon wrapper.
- **Unified Glassmorphic Overlays**: Replaced solid black circle seek overlays with unified semi-transparent glass sferes matching the volume HUD.

### Changed
- **Website Exclusions Redesign**: Replaced badge/tag cloud layout with a highly compact vertical row list of blacklisted domains with tiny delete buttons, reverting button text back to `+` to prevent overflow.
- **Default Frame Shortcuts**: Changed the default frame step backward/forward shortcuts from `N`/`M` to `<`/`>` and modified matches to bypass shift modifier checks for character keys.
