<p align="center">
  <img src="resources/logo.png" alt="Live Server (Guchho)" width="200">
</p>

<p align="center">
  <strong>Instant local server and live browser preview for VS Code.</strong>
  <br>
  Powered by <a href="https://guchho.js.org">Guchho</a> — a fast, native web build system.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/">
    <img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code Extension">
  </a>
  <a href="https://github.com/guchho/guchho">
    <img src="https://img.shields.io/badge/Powered%20by-Guchho-7C3AED?style=for-the-badge" alt="Powered by Guchho">
  </a>
  <img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="MIT License">
</p>


<p align="center">Launch a local development server and preview your HTML pages directly from VS Code. Live Server (Guchho) uses Guchho's native development server for file watching, automatic rebuilds, and a smooth browser preview workflow.</p>

<p align="center">
  <img src="resources/demo.gif" alt="Live Server (Guchho) Demo" width="800">
</p>

## 🚀 Getting Started

1. Open your web project in VS Code.
2. Open an HTML file.
3. Click **Go Live** in the status bar, or right-click the HTML file and select **Open with Live Server**.
4. Your page opens in the browser, ready for development.

> **Tip:** If your project has no Guchho configuration, the extension creates `guchho.config.json` and opens it for you to review.

## ✨ Features

| Feature | Description |
|---|---|
| 🚀 One-click launch | Start or stop the server using **Go Live** in the status bar. |
| 🌐 Instant preview | Open your HTML page in your default browser. |
| 🔄 Live rebuilds | Watch project files and rebuild when changes are detected. |
| 📂 Explorer integration | Right-click an HTML file and select **Open with Live Server**. |
| ⌨️ Keyboard shortcuts | Open or stop the server without leaving the editor. |
| ⚙️ Smart configuration | Automatically create a Guchho config when none exists. |
| 📦 Organized output | Generate preview output inside `.guchho/dist`. |
| ⚡ Native performance | Use Guchho's native development server and platform-specific binaries. |


## ⚙️ Configuration

The extension recognizes these configuration files:

- `guchho.config.js`
- `guchho.config.json`
- `guchho.json`

If none is found, it creates `guchho.config.json` in the served project root. The generated configuration uses the selected HTML file as the entry and `.guchho/dist` as the output directory.

### Settings

| Setting | Default | Description |
|---|---|---|
| `liveServerGuchho.host` | `127.0.0.1` | Host address for the local server. |
| `liveServerGuchho.port` | `5500` | Port used by the server. |
| `liveServerGuchho.root` | `.` | Project root directory to serve. |
| `liveServerGuchho.openBrowser` | `true` | Automatically open the browser when the server starts. |

## ⌨️ Commands

Open the Command Palette with `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS).

| Command | Action |
|---|---|
| `Live Server: Open with Live Server` | Start the server and open the selected page. |
| `Live Server: Stop Live Server` | Stop the running server. |
| `Live Server: Restart Live Server` | Restart the server. |
| `Live Server: Open in Browser` | Open the preview in your browser. |
| `Live Server: Toggle Live Server` | Toggle the server on or off. |

### Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|---|---|---|
| Open server | `Alt+L`, `Alt+O` | `Cmd+L`, `Cmd+O` |
| Stop server | `Alt+L`, `Alt+C` | `Cmd+L`, `Cmd+C` |

Shortcuts can be customized in **File → Preferences → Keyboard Shortcuts**.

## 🛠️ Built with Guchho

Live Server (Guchho) is powered by [Guchho](https://guchho.js.org), bringing native performance and a streamlined development workflow to your editor.

- Website: https://guchho.js.org
- GitHub: https://github.com/guchho/guchho

## 📄 License

Licensed under the **MIT License**.

Copyright © [CodeHemu](https://codehemu.in/).
