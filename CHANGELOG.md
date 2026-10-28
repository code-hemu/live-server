# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-10-28

### Added

- **Go Live** status bar control to start and stop the local server.
- Context menu and Command Palette actions to open, stop, restart, and toggle Live Server.
- Automatic browser opening and live reload through Guchho's dev server.
- Automatic creation and update of `guchho.config.json` with HTML entry detection.
- Bundled Guchho binaries for win32, linux, and darwin on x64 and arm64.
- Manual release workflow for compiling, packaging, verifying, and publishing platform-specific VSIX files.

### Changed

- Runtime now uses the bundled platform binary exclusively, removing the runtime npm dependency.
- Reduced development dependencies by removing unused packages and the inactive test harness.

### Removed

- Unused `glob`, `mocha`, and VS Code test runner dependencies.
- Tag-triggered releases; releases are now started manually with `gh workflow run release.yml`.

[Unreleased]: https://github.com/code-hemu/live-server/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/code-hemu/live-server/releases/tag/v0.0.1
