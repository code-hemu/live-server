# Contributing

Thanks for helping improve Live Server (Guchho). This guide covers the local workflow and the release steps.

## Prerequisites

- Node.js 22.x (matches CI) and npm
- VS Code 1.75 or newer
- Git

## Setup

```bash
npm install
npm run compile
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/extension.ts` | Extension entry point, commands, status bar |
| `src/server.ts` | Server lifecycle and port handling |
| `src/runtime.ts` | Locates and runs the bundled Guchho binary |
| `src/guchho-config.ts` | Detects and generates `guchho.config.json` |
| `src/browser.ts` | Browser launching helpers |
| `scripts/` | Binary download, packaging, and verification scripts |
| `bin/<platform>/` | Platform-specific Guchho binaries (not committed) |
| `out/` | Compiled JavaScript (not committed) |
| `dist/` | Packaged VSIX files (not committed) |

## Development

Compile once:

```bash
npm run compile
```

Recompile on change:

```bash
npm run watch
```

There is currently no automated test suite. Verify changes manually by launching the extension (Run and Debug, or `F5`) and exercising:

- **Go Live** status bar toggle
- `Live Server: Open with Live Server` on an HTML file
- `Live Server: Stop Live Server` and `Live Server: Restart Live Server`
- The `alt+l alt+o` / `alt+l alt+c` keybindings

## Linting

```bash
npm run lint
```

Run lint and a clean compile before opening a pull request.

## Binaries

Binaries are downloaded from Guchho releases into `bin/<platform>/`:

```bash
npm run download-binaries
```

Supported targets: `win32-x64`, `win32-arm64`, `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`.

## Packaging

Build and package every platform:

```bash
npm run build
```

Or run the steps individually:

```bash
npm run compile
npm run download-binaries
npm run package-platforms
npm run verify-package
```

This produces `dist/live-server-guchho-<platform>.vsix` plus `dist/release-manifest.json`. Each VSIX must contain only its own platform binary; `verify-package` checks this and fails the build otherwise.

Install a package locally to test it:

```bash
code --install-extension dist/live-server-guchho-win32-x64.vsix
```

## Versioning

This project follows [Semantic Versioning](https://semver.org/). For every release:

1. Update `version` in `package.json`.
2. Add a matching entry to `CHANGELOG.md` under a new `## [x.y.z] - YYYY-MM-DD` heading, and update the compare links.
3. Repackage so the VSIX version matches `package.json`.

## Publishing

Releases are started manually through the `Release` workflow (`.github/workflows/release.yml`), which compiles, lints, downloads binaries, packages all platforms, verifies the output, publishes to the Marketplace with the `VSCE_PAT` secret, and attaches the VSIX files to a GitHub release:

```bash
gh workflow run release.yml
```

To publish from a local machine instead:

```bash
export VSCE_PAT=<marketplace-token>   # PowerShell: $env:VSCE_PAT="<token>"
npx vsce publish --packagePath dist/*.vsix --skip-duplicate
```

The token must belong to the `codehemu` publisher with the Marketplace **Manage** scope.

## Pull requests

- Keep changes focused; avoid unrelated refactors.
- Match the existing TypeScript style (strict mode, no comments unless the logic is non-obvious).
- Update `README.md` and `CHANGELOG.md` when behavior or configuration changes.
- Describe how you tested the change, including the platform you used.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
