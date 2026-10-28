import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';
import { unpack } from 'guchho';

const GITHUB_REPO = 'guchho/guchho';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

const PLATFORMS = [
    'win32-x64', 'win32-arm64',
    'linux-x64', 'linux-arm64',
    'darwin-x64', 'darwin-arm64'
];

function getBinaryName(platform: string): string {
    return platform.startsWith('win32') ? 'guchho.exe' : 'guchho';
}

function normalizeVersion(version: string): string {
    return version.replace(/^v/i, '');
}

function parseArgs() {
    const args = process.argv.slice(2);
    let platform: string | undefined;
    let version: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--platform' && args[i + 1]) {
            platform = args[i + 1];
            i++;
        } else if (args[i].startsWith('--platform=')) {
            platform = args[i].split('=')[1];
        } else if (args[i] === '--version' && args[i + 1]) {
            version = normalizeVersion(args[i + 1]);
            i++;
        } else if (args[i].startsWith('--version=')) {
            version = normalizeVersion(args[i].split('=')[1]);
        }
    }

    return { platform, version };
}

async function fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'vscode-live-server',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJson(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON from ${url}: ${e}`));
                }
            });
        }).on('error', reject);
    });
}

async function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'vscode-live-server' }
        };
        const file = fs.createWriteStream(dest);
        https.get(url, options, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                try { fs.unlinkSync(dest); } catch {}
                downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                try { fs.unlinkSync(dest); } catch {}
                reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            try { file.close(); try { fs.unlinkSync(dest); } catch {} } catch {}
            reject(err);
        });
    });
}

function calculateSha256(filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function verifyChecksum(filePath: string, expectedDigest: string): boolean {
    const match = expectedDigest.match(/^sha256:(.+)$/i);
    if (!match) {
        throw new Error(`Unsupported checksum format: ${expectedDigest}`);
    }
    const expected = match[1].toLowerCase();
    const actual = calculateSha256(filePath);
    return actual === expected;
}

async function downloadForPlatform(platform: string, version: string, release: any): Promise<void> {
    const assetName = `guchho-${version}-${platform}.zip`;
    const asset = release.assets.find((a: any) => a.name === assetName);

    if (!asset) {
        throw new Error(`Asset ${assetName} not found in release v${version}. Available assets: ${release.assets.map((a: any) => a.name).join(', ')}`);
    }

    console.log(`  Found asset: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
    if (!asset.digest) {
        throw new Error(`No checksum digest available for ${asset.name}. Cannot verify integrity.`);
    }

    const rootDir = path.resolve(__dirname, '..', '..');
    const binDir = path.join(rootDir, 'bin');
    const platformDir = path.join(binDir, platform);
    if (!fs.existsSync(platformDir)) {
        fs.mkdirSync(platformDir, { recursive: true });
    }

    const tempDir = path.join(rootDir, '.tmp-download');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const zipPath = path.join(tempDir, assetName);
    const extractDir = path.join(tempDir, `${platform}-extract`);

    try {
        console.log(`  Downloading...`);
        await downloadFile(asset.browser_download_url, zipPath);
        console.log(`  Downloaded`);

        console.log(`  Verifying checksum...`);
        if (!verifyChecksum(zipPath, asset.digest)) {
            throw new Error(`Checksum verification failed for ${asset.name}`);
        }
        console.log(`  Checksum verified`);

        console.log(`  Extracting...`);
        fs.rmSync(extractDir, { recursive: true, force: true });
        await unpack({
            archive: zipPath,
            outDir: extractDir,
            overwrite: true
        });

        // Find the binary
        const binaryName = getBinaryName(platform);
        let foundBinary: string | null = null;

        const searchPaths = [
            path.join(extractDir, 'bin', binaryName),
            path.join(extractDir, binaryName)
        ];

        for (const sp of searchPaths) {
            if (fs.existsSync(sp)) {
                foundBinary = sp;
                break;
            }
        }

        if (!foundBinary) {
            // Recursive search
            const findBinary = (dir: string): string | null => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        const result = findBinary(fullPath);
                        if (result) return result;
                    } else if (entry.name === binaryName) {
                        return fullPath;
                    }
                }
                return null;
            };
            foundBinary = findBinary(extractDir);
        }

        if (!foundBinary) {
            throw new Error(`Binary ${binaryName} not found in extracted archive`);
        }

        const destBinary = path.join(platformDir, binaryName);
        fs.copyFileSync(foundBinary, destBinary);

        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(destBinary, 0o755);
            } catch (e) {
                console.warn(`  Warning: Could not set executable permissions: ${e}`);
            }
        }

        const stats = fs.statSync(destBinary);
        if (stats.size === 0) {
            throw new Error('Extracted binary is empty');
        }

        console.log(`  Installed to ${destBinary} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        // Save metadata
        const metaPath = path.join(platformDir, 'download-info.json');
        fs.writeFileSync(metaPath, JSON.stringify({
            version: version,
            platform: platform,
            asset: asset.name,
            digest: asset.digest,
            downloadedAt: new Date().toISOString(),
            source: asset.browser_download_url
        }, null, 2));

    } finally {
        // Cleanup
        try { fs.rmSync(zipPath, { recursive: true, force: true }); } catch {}
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
}

async function main() {
    const { platform, version } = parseArgs();

    if (platform && !PLATFORMS.includes(platform)) {
        throw new Error(`Unsupported platform: ${platform}. Supported: ${PLATFORMS.join(', ')}`);
    }

    const platforms = platform ? [platform] : PLATFORMS;
    const releaseUrl = version
        ? `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`
        : LATEST_RELEASE_URL;

    console.log(version ? `Fetching release v${version}...` : 'Fetching latest release...');
    const release = await fetchJson(releaseUrl);
    const resolvedVersion = normalizeVersion(version || String(release.tag_name));

    console.log(`Using guchho v${resolvedVersion}`);
    console.log(`Platforms: ${platforms.join(', ')}`);

    let failed = 0;
    for (const p of platforms) {
        console.log(`\nProcessing ${p}...`);
        try {
            await downloadForPlatform(p, resolvedVersion, release);
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n${failed === 0 ? 'Done!' : `Completed with ${failed} failure(s).`}`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
