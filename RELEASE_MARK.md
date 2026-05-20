# D2DA Follow Mouse v1.0-rc7-position-switch-stable

Marked: 2026-05-20

Status: stable after logout/re-login validation.

Validated behavior:
- Dash2Dock Animated dock position switching works without restarting this extension.
- Mouse edge trigger works across monitors after changing dock location.
- Switching back to bottom still works across monitors.

Key fix:
- Runtime state sync no longer repeatedly resets pending state during polling.
- Dock location changes reload runtime state and refresh monitor sampling safely.
