/* prefs.js
 *
 * Preferences UI for d2da-follow-mouse@neoshui.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const D2DA_SCHEMA_ID = 'org.gnome.shell.extensions.dash2dock-lite';

const CONFIG = {
    pollMs: {
        key: 'follow-mouse-poll-ms',
        title: 'Poll interval',
        subtitle: 'How often the pointer position is checked. Lower is more responsive but uses more CPU.',
        min: 50,
        max: 2000,
        step: 50,
        unit: ' ms',
    },
    debounceMs: {
        key: 'follow-mouse-debounce-ms',
        title: 'Edge dwell delay',
        subtitle: 'How long the pointer must stay on the dock edge before switching monitors.',
        min: 0,
        max: 5000,
        step: 50,
        unit: ' ms',
    },
    edgePx: {
        key: 'follow-mouse-edge-px',
        title: 'Trigger edge size',
        subtitle: 'Width of the active screen-edge trigger zone.',
        min: 1,
        max: 100,
        step: 1,
        unit: ' px',
    },
    fastSpeed: {
        key: 'follow-mouse-fast-speed',
        title: 'Fast edge push speed',
        subtitle: 'Pointer speed threshold for immediate monitor switching when hitting the dock edge.',
        min: 200,
        max: 20000,
        step: 100,
        unit: ' px/s',
    },
};

export default class D2DAFollowMousePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_title('D2DA Follow Mouse Configuration');
        window.set_default_size(720, 560);

        this._settings = this._getD2DASettings();

        const page = new Adw.PreferencesPage({
            title: 'Configuration',
            icon_name: 'input-mouse-symbolic',
        });
        window.add(page);

        const statusGroup = new Adw.PreferencesGroup({
            title: 'Status',
            description: 'This helper controls Dash2Dock Animated by writing to its GSettings keys.',
        });
        page.add(statusGroup);

        statusGroup.add(this._createInfoRow(
            'Required Dash2Dock mode',
            'Single Dock mode is required. Multi-monitor preference should be Single Dock.'
        ));
        statusGroup.add(this._createMultiMonitorRow());
        statusGroup.add(this._createDockLocationRow());
        statusGroup.add(this._createPreferredMonitorRow());

        const tuningGroup = new Adw.PreferencesGroup({
            title: 'Follow Mouse Tuning',
            description: 'Tune how quickly and how aggressively the dock follows your mouse across monitors.',
        });
        page.add(tuningGroup);

        tuningGroup.add(this._createSpinRow(CONFIG.pollMs));
        tuningGroup.add(this._createSpinRow(CONFIG.debounceMs));
        tuningGroup.add(this._createSpinRow(CONFIG.edgePx));
        tuningGroup.add(this._createSpinRow(CONFIG.fastSpeed));

        const debugGroup = new Adw.PreferencesGroup({
            title: 'Debug',
            description: 'Enable logs only while troubleshooting.',
        });
        page.add(debugGroup);
        debugGroup.add(this._createSwitchRow({
            key: 'follow-mouse-debug',
            title: 'Debug logs',
            subtitle: 'Write verbose D2DA Follow Mouse logs to the GNOME Shell journal.',
        }));

        const actionsGroup = new Adw.PreferencesGroup({title: 'Actions'});
        page.add(actionsGroup);
        actionsGroup.add(this._createResetRow());
    }

    _getD2DASettings() {
        const schemaDir = this.dir.get_child('schemas').get_path();
        const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir,
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        const schema = schemaSource.lookup(D2DA_SCHEMA_ID, true);
        if (!schema)
            throw new Error(`Settings schema not found: ${D2DA_SCHEMA_ID}`);

        return new Gio.Settings({settings_schema: schema});
    }

    _createInfoRow(title, subtitle) {
        return new Adw.ActionRow({title, subtitle});
    }

    _createSpinRow(config) {
        const adjustment = new Gtk.Adjustment({
            lower: config.min,
            upper: config.max,
            step_increment: config.step,
            page_increment: config.step * 5,
            value: this._settings.get_int(config.key),
        });

        const row = new Adw.SpinRow({
            title: config.title,
            subtitle: config.subtitle,
            adjustment,
            climb_rate: 1,
            digits: 0,
            numeric: true,
        });

        row.set_value(this._settings.get_int(config.key));

        row.connect('notify::value', () => {
            const value = Math.round(row.get_value());
            if (this._settings.get_int(config.key) !== value)
                this._settings.set_int(config.key, value);
        });

        this._settings.connect(`changed::${config.key}`, () => {
            const value = this._settings.get_int(config.key);
            if (Math.round(row.get_value()) !== value)
                row.set_value(value);
        });

        if (config.unit) {
            const suffix = new Gtk.Label({
                label: config.unit,
                valign: Gtk.Align.CENTER,
                css_classes: ['dim-label'],
            });
            row.add_suffix(suffix);
        }

        return row;
    }

    _createSwitchRow({key, title, subtitle}) {
        const row = new Adw.SwitchRow({title, subtitle});
        this._settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _createMultiMonitorRow() {
        const model = new Gtk.StringList();
        model.append('Single Dock');
        model.append('All Monitors');
        model.append('Primary Monitor');

        const row = new Adw.ComboRow({
            title: 'Multi-monitor preference',
            subtitle: 'Keep this set to Single Dock for follow-mouse switching.',
            model,
        });

        this._bindComboRow(row, 'multi-monitor-preference', 0, model.get_n_items() - 1);
        return row;
    }

    _createDockLocationRow() {
        const model = new Gtk.StringList();
        model.append('Bottom');
        model.append('Left');
        model.append('Right');
        model.append('Top');

        const row = new Adw.ComboRow({
            title: 'Dock location',
            subtitle: 'Trigger edge follows this Dash2Dock Animated dock position.',
            model,
        });

        this._bindComboRow(row, 'dock-location', 0, model.get_n_items() - 1);
        return row;
    }

    _createPreferredMonitorRow() {
        const monitorCount = this._safeGetInt('monitor-count', 1);
        const model = new Gtk.StringList();
        const count = Math.max(1, Math.min(monitorCount, 16));

        for (let i = 0; i < count; i++)
            model.append(`Monitor ${i}`);

        const row = new Adw.ComboRow({
            title: 'Preferred monitor',
            subtitle: 'Current dock monitor. This also changes when the helper follows your mouse.',
            model,
        });

        this._bindComboRow(row, 'preferred-monitor', 0, model.get_n_items() - 1);
        return row;
    }

    _bindComboRow(row, key, min, max) {
        const clamp = value => Math.max(min, Math.min(value, max));

        row.set_selected(clamp(this._settings.get_int(key)));

        row.connect('notify::selected', () => {
            const value = row.get_selected();
            if (value >= min && value <= max && this._settings.get_int(key) !== value)
                this._settings.set_int(key, value);
        });

        this._settings.connect(`changed::${key}`, () => {
            const value = clamp(this._settings.get_int(key));
            if (row.get_selected() !== value)
                row.set_selected(value);
        });
    }

    _createResetRow() {
        const row = new Adw.ActionRow({
            title: 'Reset follow-mouse settings',
            subtitle: 'Restore poll interval, debounce delay, edge size, fast push speed, and debug logs to defaults.',
        });

        const button = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        button.connect('clicked', () => {
            for (const config of Object.values(CONFIG))
                this._settings.reset(config.key);
            this._settings.reset('follow-mouse-debug');
        });

        row.add_suffix(button);
        row.activatable_widget = button;
        return row;
    }

    _safeGetInt(key, fallback) {
        try {
            return this._settings.get_int(key);
        } catch (_e) {
            return fallback;
        }
    }
}
