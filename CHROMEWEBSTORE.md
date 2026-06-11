# Chrome Web Store Listing — Theater Everywhere

> Last Updated: 2026-06-11

## Store Listing

**Extension Name**
Theater Everywhere

**Short Description**
Maximize any HTML5 video player to fill the browser viewport with a single keypress [T].

**Detailed Description**
Theater Everywhere maximizes any HTML5 video player to fill your entire browser window with a single keypress, giving you a clean, distraction-free cinematic experience.

Hello, video lovers! Theater Everywhere is built for anyone who wants to enjoy web videos without the clutter of headers, sidebars, comments, or recommendations. Whether you are watching tutorials, streams, or short clips, you can turn any video page into a cozy theater with a single keystroke.

KEY FEATURES
• One-Key Immersive Mode — Press [T] to instantly expand the active video to fit the browser viewport. Press it again or [Escape] to return to normal.
• Sleek Custom Player Controls — We overlay a clean control bar featuring play/pause, volume scrubbing with visual tooltips, and time indicators (both elapsed and remaining).
• Playback Speed Adjustments — Speed up or slow down videos dynamically to suit your pacing.
• Custom Shortcuts — Don't like [T]? Configure your own keys for toggling, exiting, seeking, and frame-stepping in the extension options page.
• Blacklist Toggle — Use the simple browser extension popup to disable Theater Everywhere on specific domains where it might conflict with native page layouts.

WHAT IS SUPPORTED
• Universal HTML5 Video — Works on standard HTML5 <video> elements across the web.
• Embedded Players (iFrames) — Detects and expands video elements embedded inside frames (such as YouTube or Vimeo embeds).
• Multi-Device Syncing — Your custom shortcut keys and blacklist settings are synced securely across all your devices using your Chrome account.

WHAT IS NOT SUPPORTED (AND KNOWN LIMITATIONS)
We want to be fully transparent about what Theater Everywhere cannot do:
• Non-Standard Subtitles: We support standard HTML5 subtitles (<track> tags). However, if a website renders subtitles using custom overlays, proprietary Javascript libraries, or sideloaded divs (like YouTube's custom CC renderer), these subtitles might not display within our custom overlay.
• DRM-Protected Services: Some streaming platforms (like Netflix or Prime Video) use DRM (Digital Rights Management) technologies that restrict video DOM manipulation, which may block the extension from scaling the video correctly.
• Legacy Players: We only support modern HTML5 web video players. Legacy plugins (like Flash or Silverlight) are not supported.

HOW TO GET STARTED
1. Open any page with a video (e.g., a video sharing platform, a news site, or a blog).
2. Press [T] on your keyboard (make sure you aren't currently typing in a search bar or comment box).
3. Sit back and enjoy! Use the custom controls at the bottom, or press [Left]/[Right] arrow keys to seek, and [N]/[M] to step frame-by-frame.
4. Press [Escape] or [T] to exit theater mode when you're done.

WE LOVE YOUR FEEDBACK!
This extension is created for you, and we want to make it as perfect as possible. If you find a website where the layout looks a bit broken in theater mode, or if you have a feature suggestion, please let us know!
You can report issues or request new features by opening a ticket on our GitHub Issues page: https://github.com/TomaszJanusz/Theater-Everywhere/issues or by emailing us. We are constantly updating and improving the extension based on your feedback.


**Category**
Productivity / Accessibility

**Single Purpose**
Maximizes any HTML5 video player to fill the browser viewport with a single keypress [T].

**Primary Language**
English


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ⬜ Not created | |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |


## Permissions Justification

Every permission in manifest.json is justified below with a specific, plain-English explanation of the user-facing feature that requires it.

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Stores and syncs custom keyboard shortcuts (for toggling, exiting, and seeking) and the website blacklist configured by the user, ensuring their preferences persist across browser restarts and sync to other devices. |
| tabs | permissions | Queries open tabs to dynamically broadcast changed configuration settings (like blacklist updates) without requiring a manual page refresh. Also identifies the active tab's hostname in the popup so users can easily toggle blacklisting. |
| \<all_urls\> | host_permissions | Necessary to detect HTML5 video elements and capture keyboard shortcut events on any website where a video is hosted. Without host permissions, the extension would not be able to offer a universal theater mode. |


## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL**
https://github.com/TomaszJanusz/Theater-Everywhere/blob/main/PRIVACY.md (Recommended to host on GitHub or a simple website)


## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free


## Developer Info

**Publisher Name**
Tomasz Janusz

**Contact Email**
tomasz.janusz@example.com

**Support URL / Email**
https://github.com/TomaszJanusz/Theater-Everywhere/issues


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-11 | Initial release with theater mode toggle, custom shortcuts, unified controls, and domain blacklist. | Draft |
