# Native Dock Follow Mouse

Standalone GNOME Shell dock that follows the mouse across monitors.

本分支目标：去掉对其他 dock 扩展的依赖，使用 GNOME Shell 原生能力实现 dock 显示、dock 数量和 dock 跟随。

## 当前能力

- 不依赖 Dash2Dock Animated / Dash to Dock / Ubuntu Dock
- 使用 GNOME Shell 原生 `St` actor 绘制 dock
- 图标来自 GNOME 收藏应用列表
- 点击图标通过 `Shell.App.activate()` 启动或聚焦应用
- 支持三种 dock 数量模式：
  - Single dock follows mouse：单 dock，鼠标触碰目标屏幕边缘后切换过去
  - Dock on every monitor：每个显示器一个 dock
  - Primary monitor only：只在主显示器显示 dock
- 支持 dock 位置：底部、左侧、右侧、顶部
- 支持边缘停留触发和高速撞边立即触发
- schema 只安装在扩展自身目录，不污染全局 schema

## 依赖

- GNOME Shell 46/47/48
- 无外部 dock 扩展依赖

## 安装

```bash
./install.sh
```

然后注销再登录。Wayland 下不建议依赖 `Alt+F2` 的 `r` 重启方式。

## 卸载

```bash
./install.sh --uninstall
```

## 配置

可在 GNOME Extensions / Extension Manager 中打开本扩展设置页。

GUI 支持调整：

- Dock mode：单 dock 跟随 / 每屏一个 / 仅主屏
- Dock location：底部、左侧、右侧、顶部
- Preferred monitor：单 dock 初始显示器
- Icon size：dock 图标大小
- Poll interval：鼠标轮询间隔
- Edge dwell delay：边缘停留防抖时间
- Trigger edge size：触发边缘宽度
- Fast edge push speed：高速撞边立即切换阈值
- Debug logs：调试日志开关

也可以用本地 schema 调整：

```bash
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/native-dock-follow-mouse@neoshui"
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.native-dock-follow-mouse dock-mode 0
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.native-dock-follow-mouse dock-location 0
gsettings --schemadir "$EXT_DIR/schemas" set org.gnome.shell.extensions.native-dock-follow-mouse follow-mouse-icon-size 42
```

## 打包

```bash
./package.sh
```

输出：

```text
dist/native-dock-follow-mouse@neoshui.zip
```

## 排障

- 看日志：`journalctl -f /usr/bin/gnome-shell`
- 若提示 schema not found，确认 `schemas/org.gnome.shell.extensions.native-dock-follow-mouse.gschema.xml` 已随扩展安装
- 若 dock 没有图标，先在 GNOME 中添加收藏应用
- Wayland 下建议注销登录来重新加载扩展

## 说明

这是 Native Dock 第一版，先完成"去依赖 + 原生 dock + 多屏跟随"的基础闭环；后续可以继续补运行指示器、应用网格按钮、窗口预览、自动隐藏、拖拽排序等增强功能。

## License

GPL-2.0-or-later
