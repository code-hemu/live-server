import * as fs from 'fs';
import * as path from 'path';
import { unpack } from 'guchho';

const PLATFORMS = [
    'win32-x64', 'win32-arm64',
    'linux-x64', 'linux-arm64',
    'darwin-x64', 'darwin-arm64'
];

async function verifyPackages() {
    console.log('Verifying packages...');
    
    const rootDir = path.resolve(__dirname, '..', '..');
    const distDir = path.join(rootDir, 'dist');
    if (!fs.existsSync(distDir)) {
        console.log('No dist directory found. Run packaging first.');
        return;
    }
    
    const tempDir = path.join(rootDir, '.tmp-verify');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let allValid = true;
    
    for (const platform of PLATFORMS) {
        const vsixPath = path.join(distDir, `live-server-guchho-${platform}.vsix`);
        if (!fs.existsSync(vsixPath)) {
            console.log(`✗ ${platform}: not found`);
            allValid = false;
            continue;
        }
        
        const stats = fs.statSync(vsixPath);
        console.log(`\nChecking ${platform} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);
        
        const extractDir = path.join(tempDir, platform);
        fs.rmSync(extractDir, { recursive: true, force: true });
        
        try {
            await unpack({
                archive: vsixPath,
                outDir: extractDir,
                format: 'zip',
                overwrite: true
            });
            
            const extDir = path.join(extractDir, 'extension');
            if (!fs.existsSync(extDir)) {
                console.log(`  ✗ No extension/ folder found`);
                allValid = false;
                continue;
            }
            
            const binaryName = platform.startsWith('win32') ? 'guchho.exe' : 'guchho';
            const binaryPath = path.join(extDir, 'bin', platform, binaryName);
            
            if (fs.existsSync(binaryPath)) {
                console.log(`  ✓ Binary found: bin/${platform}/${binaryName}`);
            } else {
                console.log(`  ✗ Binary missing: bin/${platform}/${binaryName}`);
                allValid = false;
            }
            
            // Check for other platform binaries
            let wrongBinaryFound = false;
            for (const otherPlatform of PLATFORMS) {
                if (otherPlatform === platform) continue;
                const otherBinaryName = otherPlatform.startsWith('win32') ? 'guchho.exe' : 'guchho';
                const otherBinaryPath = path.join(extDir, 'bin', otherPlatform, otherBinaryName);
                if (fs.existsSync(otherBinaryPath)) {
                    console.log(`  ✗ Wrong platform binary found: bin/${otherPlatform}/${otherBinaryName}`);
                    wrongBinaryFound = true;
                    allValid = false;
                }
            }
            if (!wrongBinaryFound) {
                console.log(`  ✓ No wrong platform binaries found`);
            }
            
            // Check required files
            const requiredFiles = ['package.json', 'out/src/extension.js'];
            for (const rf of requiredFiles) {
                if (fs.existsSync(path.join(extDir, rf))) {
                    console.log(`  ✓ ${rf} present`);
                } else {
                    console.log(`  ✗ ${rf} missing`);
                    allValid = false;
                }
            }
            
        } catch (err: any) {
            console.log(`  ✗ Error extracting: ${err.message}`);
            allValid = false;
        }
    }
    
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    
    console.log(`\n${allValid ? '✓ All packages valid' : '✗ Some packages have issues'}`);
    process.exit(allValid ? 0 : 1);
}

verifyPackages().catch(console.error);
