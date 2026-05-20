# D2DA Follow Mouse v1.0-rc8-gui

Marked: 2026-05-20

Status: GUI preferences release.

What changed:
- Added GNOME Shell preferences UI
- Exposed poll interval, debounce, edge size, fast push speed
- Added dock location, preferred monitor, and multi-monitor preference controls
- Preferences now open cleanly in GNOME Extensions / Extension Manager
- Preferred monitor options now adapt to the current display session

Validation:
- prefs.js and extension.js syntax checked
- metadata.json validated
- schema compiled
- package and install scripts verified
- preferences window opens successfully

Notes:
- This release still targets Dash2Dock Animated-style dock control
- Next branch will move toward direct GNOME Shell dock control without external dock dependency
