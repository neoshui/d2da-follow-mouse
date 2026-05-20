# D2DA Follow Mouse

让 [Dash2Dock Animated](https://extensions.gnome.org/extension/4995/dash2dock-animated/) 的 dock 在多显示器间智能切换：鼠标碰到哪个屏幕的底部边缘，dock 就出现在哪个屏幕。

Smart dock switching for Dash2Dock Animated in multi-monitor setups: move your mouse to the bottom edge of any screen, and the dock appears there.

## 工作方式 / How It Works

- 平时鼠标随意移动，dock 不受影响
- 当鼠标碰到另一台显示器的 dock 所在屏幕边缘（默认底部 5px 以内）并停留 0.4 秒，dock 自动切换到该显示器
- 如果鼠标高速撞向 dock 所在边缘，会判定为“用力推边缘”，跳过防抖并立即切换 dock
- 支持 Dash2Dock Animated 的 dock 位置变化：底部、左侧、右侧、顶部会自动切换对应触发边缘
- 增加了多显示器布局容错：会过滤无效 monitor、保护 primaryIndex，并在离开边缘后重置 pending 状态
- 扩展从自身目录加载 Dash2Dock Animated 的 schema，不污染全局 schema

## 依赖 / Dependencies

- GNOME Shell 46/47/48
- [Dash2Dock Animated](https://extensions.gnome.org/extension/4995/dash2dock-animated/) 已安装并启用
- Dash2Dock Animated 的「Multi Monitor Preference」需设为「Single Dock」
- 不依赖原版 Dash to Dock / Dash2Dock 扩展

## 安装 / Install

```bash
./install.sh
```

然后注销再登录。Wayland 下不建议依赖 `Alt+F2` 的 `r` 重启方式。

## 卸载 / Uninstall

```bash
./install.sh --uninstall
```

## 配置 / Configuration

参数已经做成 GSettings 配置项，安装后可用下面命令调整：

```bash
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/d2da-follow-mouse@neoshui"
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.dash2dock-lite follow-mouse-poll-ms 200
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.dash2dock-lite follow-mouse-debounce-ms 400
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.dash2dock-lite follow-mouse-edge-px 5
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.dash2dock-lite follow-mouse-fast-speed 1800
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.dash2dock-lite follow-mouse-debug false
```

| 配置项 | 默认值 | 说明 |
|------|--------|------|
| `follow-mouse-poll-ms` | 200 | 鼠标位置轮询间隔，范围 50-2000ms |
| `follow-mouse-debounce-ms` | 400 | 边缘停留触发延迟，范围 0-5000ms |
| `follow-mouse-edge-px` | 5 | 底部边缘触发距离，范围 1-100px |
| `follow-mouse-fast-speed` | 1800 | 高速撞边立即触发阈值，范围 200-20000px/s |
| `follow-mouse-debug` | false | 是否输出详细调试日志 |

改完配置后，建议注销再登录或重启扩展。

## 打包 / Package

发布前建议将整个目录打包为 zip，确保包含：

- `extension.js`
- `metadata.json`
- `stylesheet.css`
- `schemas/org.gnome.shell.extensions.dash2dock-lite.gschema.xml`
- `install.sh`

## 排障 / Troubleshooting

- 看日志：`journalctl -f /usr/bin/gnome-shell`
- 若提示 schema not found，确认 `schemas/` 已随扩展安装
- 若 dock 不切换，确认 Dash2Dock Animated 已启用且 Single Dock 模式已开启

## License

GPL-2.0-or-later
