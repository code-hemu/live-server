import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

const PLATFORMS = [
    'win32-x64', 'win32-arm64',
    'linux-x64', 'linux-arm64',
    'darwin-x64', 'darwin-arm64'
];

function calculateChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function packagePlatforms() {
    console.log('Packaging for all platforms...');
    
    const distDir = path.resolve(__dirname, '..', 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Compile first
    console.log('Compiling TypeScript...');
    try {
        execSync('npm run compile', { stdio: 'inherit' });
    } catch (err) {
        console.error('Compilation failed');
        process.exit(1);
    }
    
    const manifest: any[] = [];
    const binDir = path.resolve(__dirname, '..', 'bin');
    const rootDir = path.resolve(__dirname, '..');
    const originalIgnorePath = path.join(rootDir, '.vscodeignore');
    const originalIgnore = fs.readFileSync(originalIgnorePath, 'utf8');
    
    for (const platform of PLATFORMS) {
        console.log(`\nPackaging for ${platform}...`);
        
        // Create a temporary ignore file that excludes all other platform binaries.
        // Never rewrite the real .vscodeignore: an interrupted package run must not
        // leave the workspace with a platform-specific ignore file.
        let ignoreContent = originalIgnore.trimEnd() + '\n\n';
        
        for (const otherPlatform of PLATFORMS) {
            if (otherPlatform !== platform) {
                ignoreContent += `bin/${otherPlatform}/**\n`;
            }
        }
        
        const tempIgnorePath = path.join(rootDir, `.vscodeignore.${platform}.tmp`);
        fs.writeFileSync(tempIgnorePath, ignoreContent);
        
        try {
            const vsixName = `live-server-guchho-${platform}.vsix`;
            const output = execSync(
                `npx vsce package --target ${platform} --ignoreFile "${tempIgnorePath}" --out dist/${vsixName}`,
                { stdio: 'pipe', encoding: 'utf8', cwd: rootDir }
            );
            console.log(output.split('\n').slice(-10).join('\n'));
            
            const vsixPath = path.join(distDir, vsixName);
            if (fs.existsSync(vsixPath)) {
                const checksum = calculateChecksum(vsixPath);
                const stats = fs.statSync(vsixPath);
                manifest.push({
                    target: platform,
                    filename: vsixName,
                    size: stats.size,
                    sha256: checksum
                });
                console.log(`  Created ${vsixPath} (${(stats.size/1024/1024).toFixed(2)} MB, sha256: ${checksum.substring(0, 16)}...)`);
            } else {
                console.error(`  Failed: ${vsixPath} was not created`);
                process.exitCode = 1;
            }
        } catch (err: any) {
            console.error(`  Failed: ${err.message}`);
            process.exitCode = 1;
        } finally {
            try {
                if (fs.existsSync(tempIgnorePath)) fs.unlinkSync(tempIgnorePath);
            } catch {}
        }
    }
    
    const manifestPath = path.join(distDir, 'release-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
        version: require('../package.json').version,
        createdAt: new Date().toISOString(),
        packages: manifest
    }, null, 2));
    
    console.log(`\nManifest written to ${manifestPath}`);
    console.log('Done!');
}

packagePlatforms().catch(console.error);
