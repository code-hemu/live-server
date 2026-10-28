import * as path from 'path';
import * as fs from 'fs';

export interface RuntimeInfo {
    executablePath: string;
    platform: string;
    arch: string;
}

function getPlatformKey(): string {
    const platform = process.platform;
    const arch = process.arch;
    return `${platform}-${arch}`;
}

function getBinaryName(): string {
    return process.platform === 'win32' ? 'guchho.exe' : 'guchho';
}

export function resolveBinary(extensionPath?: string): RuntimeInfo {
    const platformKey = getPlatformKey();
    const binaryName = getBinaryName();
    const root = extensionPath || path.resolve(__dirname, '..', '..');
    
    // Check bundled binary in bin/{platform}/
    const bundledPath = path.join(root, 'bin', platformKey, binaryName);
    if (fs.existsSync(bundledPath)) {
        return {
            executablePath: bundledPath,
            platform: process.platform,
            arch: process.arch
        };
    }

    throw new Error(
        `Could not find Guchho binary for ${platformKey}. ` +
        `Please ensure the extension is properly installed for your platform.`
    );
}

export function isPlatformSupported(): boolean {
    const supported = [
        'win32-x64', 'win32-arm64',
        'linux-x64', 'linux-arm64',
        'darwin-x64', 'darwin-arm64'
    ];
    return supported.includes(getPlatformKey());
}
