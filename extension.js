/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const D2DA_SCHEMA_ID = 'org.gnome.shell.extensions.dash2dock-lite';

const DEFAULT_POLL_MS = 200;
const DEFAULT_DEBOUNCE_MS = 400;
const DEFAULT_EDGE_PX = 5;
const DEFAULT_FAST_SPEED = 1800;
const DEFAULT_DOCK_LOCATION = 0;
const MIN_POLL_MS = 50;
const MAX_POLL_MS = 2000;
const MIN_DEBOUNCE_MS = 0;
const MAX_DEBOUNCE_MS = 5000;
const MIN_EDGE_PX = 1;
const MAX_EDGE_PX = 100;
const MIN_FAST_SPEED = 200;
const MAX_FAST_SPEED = 20000;
const MIN_DOCK_LOCATION = 0;
const MAX_DOCK_LOCATION = 3;

export default class D2DAFollowMouseExtension extends Extension {
    enable() {
        this._settings = null;
        this._settingsSignals = [];
        this._timeoutId = null;
        this._currentMonitor = -1;
        this._pendingMonitor = -1;
        this._pendingSince = 0;
        this._lastSwitchUs = 0;
        this._debug = false;
        this._pollMs = DEFAULT_POLL_MS;
        this._debounceMs = DEFAULT_DEBOUNCE_MS;
        this._fastSpeedThreshold = DEFAULT_FAST_SPEED;
        this._dockLocation = DEFAULT_DOCK_LOCATION;
        this._preferredMonitorSetting = -1;
        this._lastX = null;
        this._lastY = null;
        this._lastSampleUs = 0;

        try {
            const schemaDir = this.dir.get_child('schemas').get_path();
            const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir,
                Gio.SettingsSchemaSource.get_default(),
                false
            );
            const schema = schemaSource.lookup(D2DA_SCHEMA_ID, true);
            if (!schema) {
                console.warn('[D2DA-follow-mouse] schema not found in extension dir');
                return;
            }
            this._settings = new Gio.Settings({settings_schema: schema});
        } catch (e) {
            console.warn('[D2DA-follow-mouse] cannot access Dash2Dock Animated settings:', e.message);
            return;
        }

        this._loadConfig();
        this._connectSettingsSignals();

        if (this._settings.get_int('multi-monitor-preference') !== 0) {
            this._warn('multi-monitor is not single-dock mode, exiting');
            return;
        }

        this._preferredMonitorSetting = -1;
        this._currentMonitor = this._monitorFromPreferredSetting();
        if (!this._isValidMonitor(this._currentMonitor))
            this._currentMonitor = this._getMonitorAt(...global.get_pointer());
        this._preferredMonitorSetting = this._settings.get_int('preferred-monitor');
        this._pendingMonitor = this._currentMonitor;
        this._pendingSince = GLib.get_monotonic_time();
        [this._lastX, this._lastY] = global.get_pointer();
        this._lastSampleUs = this._pendingSince;

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._pollMs, () => {
            try {
                this._poll();
                return GLib.SOURCE_CONTINUE;
            } catch (e) {
                this._warn(`poll failed: ${e.message}`);
                return GLib.SOURCE_CONTINUE;
            }
        });

        this._log(`enabled: poll=${this._pollMs}ms debounce=${this._debounceMs}ms edge=${this._edgePx}px current=${this._currentMonitor}`);
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._settingsSignals) {
            for (const id of this._settingsSignals)
                this._settings?.disconnect(id);
            this._settingsSignals = [];
        }
        this._settings = null;
        this._log('disabled');
    }

    _loadConfig() {
        this._debug = this._getBoolean('follow-mouse-debug', false);
        this._pollMs = this._clampInt(this._getInt('follow-mouse-poll-ms', DEFAULT_POLL_MS), MIN_POLL_MS, MAX_POLL_MS);
        this._debounceMs = this._clampInt(this._getInt('follow-mouse-debounce-ms', DEFAULT_DEBOUNCE_MS), MIN_DEBOUNCE_MS, MAX_DEBOUNCE_MS);
        this._edgePx = this._clampInt(this._getInt('follow-mouse-edge-px', DEFAULT_EDGE_PX), MIN_EDGE_PX, MAX_EDGE_PX);
        this._fastSpeedThreshold = this._clampInt(this._getInt('follow-mouse-fast-speed', DEFAULT_FAST_SPEED), MIN_FAST_SPEED, MAX_FAST_SPEED);
        this._dockLocation = this._clampInt(this._getInt('dock-location', DEFAULT_DOCK_LOCATION), MIN_DOCK_LOCATION, MAX_DOCK_LOCATION);
    }

    _connectSettingsSignals() {
        this._settingsSignals.push(
            this._settings.connect('changed::preferred-monitor', () => this._syncCurrentMonitorFromSettings('preferred-monitor')),
            this._settings.connect('changed::multi-monitor-preference', () => this._onMultiMonitorPreferenceChanged()),
            this._settings.connect('changed::follow-mouse-poll-ms', () => this._restartPolling()),
            this._settings.connect('changed::follow-mouse-debounce-ms', () => this._loadConfig()),
            this._settings.connect('changed::follow-mouse-edge-px', () => this._loadConfig()),
            this._settings.connect('changed::follow-mouse-fast-speed', () => this._loadConfig()),
            this._settings.connect('changed::follow-mouse-debug', () => this._loadConfig()),
            this._settings.connect('changed::dock-location', () => this._onDockLocationChanged())
        );
    }

    _onDockLocationChanged() {
        this._reloadRuntimeState('dock-location');
    }

    _restartPolling() {
        const oldPollMs = this._pollMs;
        this._loadConfig();

        if (this._pollMs === oldPollMs)
            return;

        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._pollMs, () => {
            try {
                this._poll();
                return GLib.SOURCE_CONTINUE;
            } catch (e) {
                this._warn(`poll failed: ${e.message}`);
                return GLib.SOURCE_CONTINUE;
            }
        });
        this._log(`poll interval changed: ${this._pollMs}ms`);
    }

    _onMultiMonitorPreferenceChanged() {
        const preference = this._settings.get_int('multi-monitor-preference');
        if (preference !== 0) {
            this._warn('multi-monitor is not single-dock mode, follow-mouse paused');
            this._resetPending();
            return;
        }

        this._reloadRuntimeState('multi-monitor-preference');
    }

    _syncCurrentMonitorFromSettings(reason = 'settings') {
        const preferredMonitor = this._settings.get_int('preferred-monitor');
        if (preferredMonitor === this._preferredMonitorSetting)
            return false;

        const monitorIdx = this._monitorFromPreferredSetting();
        if (!this._isValidMonitor(monitorIdx)) {
            this._warn(`cannot sync monitor from settings (${reason})`);
            this._preferredMonitorSetting = preferredMonitor;
            return false;
        }

        this._preferredMonitorSetting = preferredMonitor;
        this._currentMonitor = monitorIdx;
        this._pendingMonitor = monitorIdx;
        this._pendingSince = GLib.get_monotonic_time();
        [this._lastX, this._lastY] = global.get_pointer();
        this._lastSampleUs = this._pendingSince;
        this._log(`synced current monitor=${monitorIdx} from ${reason}`);
        return true;
    }

    _monitorFromPreferredSetting() {
        const primaryIndex = Main.layoutManager.primaryIndex;
        const preferredMonitor = this._settings.get_int('preferred-monitor');

        if (!Number.isInteger(primaryIndex) || primaryIndex < 0)
            return -1;

        if (preferredMonitor === 0)
            return primaryIndex;

        if (preferredMonitor === primaryIndex)
            return 0;

        return preferredMonitor;
    }

    _reloadRuntimeState(reason = 'settings') {
        const oldDockLocation = this._dockLocation;
        const oldCurrentMonitor = this._currentMonitor;
        this._loadConfig();

        const synced = this._syncCurrentMonitorFromSettings(reason);
        if (synced && (oldDockLocation !== this._dockLocation || oldCurrentMonitor !== this._currentMonitor))
            this._log(`runtime sync: current=${this._currentMonitor} dockLocation=${this._dockLocation}`);
    }

    _refreshRuntimeState() {
        this._reloadRuntimeState('poll');
    }

    _poll() {
        this._refreshRuntimeState();

        if (this._settings.get_int('multi-monitor-preference') !== 0)
            return;

        const [x, y] = global.get_pointer();
        const now = GLib.get_monotonic_time();
        const monitorIdx = this._getMonitorAt(x, y);
        const fastPush = this._isFastEdgePush(x, y, monitorIdx, now);

        this._lastX = x;
        this._lastY = y;
        this._lastSampleUs = now;

        if (fastPush) {
            this._switchMonitor(monitorIdx, true);
            return;
        }
        if (!this._isValidMonitor(monitorIdx)) {
            this._resetPending();
            return;
        }

        if (monitorIdx === this._currentMonitor) {
            this._resetPending();
            return;
        }

        const mon = Main.layoutManager.monitors[monitorIdx];
        if (!mon || !this._isTriggerEdge(x, y, mon)) {
            this._resetPending();
            return;
        }

        if (monitorIdx === this._pendingMonitor) {
            if ((now - this._pendingSince) / 1000 >= this._debounceMs) {
                this._switchMonitor(monitorIdx);
            }
        } else {
            this._pendingMonitor = monitorIdx;
            this._pendingSince = now;
            this._log(`pending monitor ${monitorIdx}`);
        }
    }

    _getMonitorAt(x, y) {
        const monitors = Main.layoutManager.monitors ?? [];

        for (let i = 0; i < monitors.length; i++) {
            const m = monitors[i];
            if (!this._isMonitorUsable(m))
                continue;

            if (x >= m.x && x < m.x + m.width &&
                y >= m.y && y < m.y + m.height) {
                return i;
            }
        }
        return -1;
    }

    _switchMonitor(monitorIdx, immediate = false) {
        if (!this._isValidMonitor(monitorIdx) || monitorIdx === this._currentMonitor)
            return;

        const primaryIndex = Main.layoutManager.primaryIndex;
        if (!Number.isInteger(primaryIndex) || primaryIndex < 0) {
            this._warn('invalid primary monitor index');
            return;
        }

        let prefValue;
        if (monitorIdx === primaryIndex) {
            prefValue = 0;
        } else if (monitorIdx === 0) {
            prefValue = primaryIndex;
        } else {
            prefValue = monitorIdx;
        }

        try {
            this._settings.set_int('preferred-monitor', prefValue);
            this._currentMonitor = monitorIdx;
            this._pendingMonitor = monitorIdx;
            this._pendingSince = GLib.get_monotonic_time();
            this._lastSwitchUs = this._pendingSince;
            this._log(`dock → monitor ${monitorIdx} (pref=${prefValue})${immediate ? ' [fast]' : ''}`);
        } catch (e) {
            this._warn(`failed to switch monitor: ${e.message}`);
        }
    }

    _resetPending() {
        if (this._pendingMonitor !== this._currentMonitor)
            this._log('reset pending');

        this._pendingMonitor = this._currentMonitor;
        this._pendingSince = GLib.get_monotonic_time();
    }

    _isFastEdgePush(x, y, monitorIdx, nowUs) {
        if (!this._isValidMonitor(monitorIdx))
            return false;

        if (monitorIdx === this._currentMonitor)
            return false;

        const mon = Main.layoutManager.monitors[monitorIdx];
        if (!mon || !this._isTriggerEdge(x, y, mon))
            return false;

        if (!Number.isFinite(this._lastX) || !Number.isFinite(this._lastY) || !this._lastSampleUs)
            return false;

        const dtMs = (nowUs - this._lastSampleUs) / 1000;
        if (dtMs <= 0)
            return false;

        const dx = x - this._lastX;
        const dy = y - this._lastY;
        const distance = Math.hypot(dx, dy);
        const speed = distance / dtMs;

        if (speed >= this._fastSpeedThreshold) {
            this._log(`fast edge push monitor=${monitorIdx} speed=${speed.toFixed(0)}px/s threshold=${this._fastSpeedThreshold}`);
            return true;
        }

        return false;
    }

    _isValidMonitor(index) {
        const monitors = Main.layoutManager.monitors ?? [];
        return Number.isInteger(index) && index >= 0 && index < monitors.length && this._isMonitorUsable(monitors[index]);
    }

    _isMonitorUsable(monitor) {
        return monitor && Number.isFinite(monitor.x) && Number.isFinite(monitor.y) &&
            Number.isFinite(monitor.width) && Number.isFinite(monitor.height) &&
            monitor.width > 0 && monitor.height > 0;
    }

    _isTriggerEdge(x, y, monitor) {
        if (!this._isMonitorUsable(monitor))
            return false;

        const onBottom = this._isBottomEdge(y, monitor);
        const onLeft = x >= monitor.x && x < monitor.x + this._edgePx;
        const onRight = x >= monitor.x + monitor.width - this._edgePx &&
            x < monitor.x + monitor.width;
        const onTop = y >= monitor.y && y < monitor.y + this._edgePx;

        switch (this._dockLocation) {
        case 1:
            return onLeft;
        case 2:
            return onRight;
        case 3:
            return onTop;
        case 0:
        default:
            return onBottom;
        }
    }

    _isBottomEdge(y, monitor) {
        if (!this._isMonitorUsable(monitor))
            return false;

        return y >= monitor.y + monitor.height - this._edgePx &&
            y < monitor.y + monitor.height;
    }

    _getInt(key, fallback) {
        try {
            return this._settings.get_int(key);
        } catch (e) {
            this._warn(`missing int setting ${key}, fallback=${fallback}`);
            return fallback;
        }
    }

    _getBoolean(key, fallback) {
        try {
            return this._settings.get_boolean(key);
        } catch (e) {
            return fallback;
        }
    }

    _clampInt(value, min, max) {
        if (!Number.isInteger(value))
            return min;
        return Math.max(min, Math.min(max, value));
    }

    _log(message) {
        if (this._debug)
            console.log(`[D2DA-follow-mouse] ${message}`);
    }

    _warn(message) {
        console.warn(`[D2DA-follow-mouse] ${message}`);
    }
}
