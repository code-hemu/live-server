import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';
import { unpack } from 'guchho';

const PLATFORMS = [
    'win32-x64', 'win32-arm64',
    'linux-x64', 'linux-arm64',
    'darwin-x64', 'darwin-arm64'
];

function getPackageName(platformKey: string): string {
    return `@guchho/${platformKey}`;
}

function getBinaryName(platformKey: string): string {
    return platformKey.startsWith('win32') ? 'guchho.exe' : 'guchho';
}

async function fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'vscode-live-server', 'Accept': 'application/json' } }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJson(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'vscode-live-server' } }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            try { file.close(); fs.unlinkSync(dest); } catch {}
            reject(err);
        });
    });
}

function verifyIntegrity(filePath: string, expectedIntegrity: string): boolean {
    try {
        // expectedIntegrity format: sha512-... or sha256-...
        const match = expectedIntegrity.match(/^(sha\d+)-(.+)$/);
        if (!match) return false;
        const algo = match[1].replace('sha', 'sha');
        const expected = Buffer.from(match[2], 'base64');
        const hash = crypto.createHash(algo === 'sha512' ? 'sha512' : algo).update(fs.readFileSync(filePath)).digest();
        return hash.equals(expected);
    } catch {
        return false;
    }
}

async function prepareBinaries() {
    console.log('Preparing binaries for all platforms...');
    
    const rootDir = path.resolve(__dirname, '..', '..');
    const binDir = path.join(rootDir, 'bin');
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }
    
    const tempDir = path.join(rootDir, '.tmp-binaries');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    for (const platform of PLATFORMS) {
        console.log(`\nProcessing ${platform}...`);
        const platformDir = path.join(binDir, platform);
        if (!fs.existsSync(platformDir)) {
            fs.mkdirSync(platformDir, { recursive: true });
        }
        
        const pkgName = getPackageName(platform);
        try {
            const pkgInfo = await fetchJson(`https://registry.npmjs.org/${pkgName}/latest`);
            console.log(`  Found ${pkgName}@${pkgInfo.version}`);
            console.log(`  Tarball: ${pkgInfo.dist.tarball}`);
            
            const tarPath = path.join(tempDir, `${platform}.tgz`);
            await downloadFile(pkgInfo.dist.tarball, tarPath);
            console.log(`  Downloaded to ${tarPath}`);
            
            if (pkgInfo.dist.integrity) {
                if (verifyIntegrity(tarPath, pkgInfo.dist.integrity)) {
                    console.log(`  Integrity verified`);
                } else {
                    console.error(`  Integrity verification failed!`);
                    continue;
                }
            }
            
            const extractDir = path.join(tempDir, platform);
            fs.rmSync(extractDir, { recursive: true, force: true });
            
            await unpack({
                archive: tarPath,
                outDir: extractDir,
                format: 'tar.gz',
                overwrite: true
            });
            console.log(`  Extracted`);
            
            // Look for binary in package/bin or bin/
            const binaryName = getBinaryName(platform);
            let foundBinary: string | null = null;
            
            // Search in extracted package
            const searchPaths = [
                path.join(extractDir, 'package', 'bin', binaryName),
                path.join(extractDir, 'bin', binaryName),
                path.join(extractDir, 'package', binaryName),
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
                const findFile = (dir: string): string | null => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            const result = findFile(fullPath);
                            if (result) return result;
                        } else if (entry.name === binaryName) {
                            return fullPath;
                        }
                    }
                    return null;
                };
                foundBinary = findFile(extractDir);
            }
            
            if (foundBinary) {
                const destBinary = path.join(platformDir, binaryName);
                fs.copyFileSync(foundBinary, destBinary);
                
                if (process.platform !== 'win32') {
                    fs.chmodSync(destBinary, 0o755);
                }
                
                console.log(`  Copied binary to ${destBinary}`);
                
                // Write metadata
                const metaPath = path.join(platformDir, 'binary.json');
                fs.writeFileSync(metaPath, JSON.stringify({
                    package: pkgName,
                    version: pkgInfo.version,
                    integrity: pkgInfo.dist.integrity,
                    preparedAt: new Date().toISOString(),
                    binaryName: binaryName
                }, null, 2));
            } else {
                console.error(`  Binary ${binaryName} not found in package!`);
            }
            
            // Cleanup tar
            fs.unlinkSync(tarPath);
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }
    }
    
    // Cleanup temp dir
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    
    console.log('\nDone!');
}

prepareBinaries().catch(console.error);
