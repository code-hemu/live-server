import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const CONFIG_NAMES = ['guchho.config.js', 'guchho.config.json', 'guchho.json'];
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const IGNORED_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    '.guchho',
    '.vscode',
    '.vscode-test',
    'dist',
    'build',
    'out',
    'coverage'
]);
const GENERATED_OUTDIR = '.guchho/dist';

export interface GuchhoConfigResult {
    path: string;
    created: boolean;
    updated: boolean;
    entries: string[];
    outbase: string;
    primary: string | undefined;
}

function findConfigFile(projectDir: string): string | undefined {
    // Only look in the project itself. Guchho walks upward for a config, so a
    // stray config in a parent folder (for example the user's home directory)
    // would otherwise take over an unrelated project.
    const dir = path.resolve(projectDir);

    for (const name of CONFIG_NAMES) {
        const candidate = path.join(dir, name);
        try {
            if (fs.statSync(candidate).isFile()) {
                return candidate;
            }
        } catch {
            // Not present; try the next candidate.
        }
    }

    return undefined;
}

function isHtmlFile(filePath: string): boolean {
    return HTML_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function scanHtmlFiles(serveDir: string): string[] {
    const files: string[] = [];
    const directories: string[] = [''];
    const visited = new Set<string>();

    while (directories.length > 0) {
        const relativeDir = directories.shift() as string;
        const absoluteDir = path.join(serveDir, relativeDir);

        let realDir: string;
        try {
            realDir = fs.realpathSync(absoluteDir);
        } catch {
            continue;
        }
        if (visited.has(realDir)) {
            continue;
        }
        visited.add(realDir);

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
        } catch {
            continue;
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                if (!IGNORED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
                    directories.push(relative);
                }
                continue;
            }

            if (entry.isFile() && isHtmlFile(entry.name)) {
                files.push(relative);
            }
        }
    }

    files.sort((a, b) => a.localeCompare(b));
    return files;
}

function commonDirectory(entries: string[]): string {
    if (entries.length === 0) {
        return '.';
    }

    const directories = entries.map((entry) => entry.split('/').slice(0, -1));
    let common = directories[0];

    for (let i = 1; i < directories.length; i++) {
        let j = 0;
        while (j < common.length && j < directories[i].length && common[j] === directories[i][j]) {
            j++;
        }
        common = common.slice(0, j);
    }

    return common.length > 0 ? common.join('/') : '.';
}

function relativeEntry(serveDir: string, fileUri: vscode.Uri | undefined): string | undefined {
    if (!fileUri || fileUri.scheme !== 'file' || !isHtmlFile(fileUri.fsPath)) {
        return undefined;
    }

    const relative = path.relative(serveDir, fileUri.fsPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        return undefined;
    }

    return relative.split(path.sep).join('/');
}

function findPrimary(entries: string[], serveDir: string, fileUri?: vscode.Uri): string | undefined {
    const selected = relativeEntry(serveDir, fileUri);
    if (selected && entries.includes(selected)) {
        return selected;
    }

    const preferred = ['index.html', 'src/index.html'];
    for (const candidate of preferred) {
        if (entries.includes(candidate)) {
            return candidate;
        }
    }

    const anyIndex = entries.find((entry) => path.posix.basename(entry).toLowerCase() === 'index.html');
    return anyIndex || entries[0];
}

function readJsonConfig(configPath: string): any | undefined {
    if (!configPath.toLowerCase().endsWith('.json')) {
        return undefined;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return undefined;
    }
}

function openConfigFile(configPath: string): void {
    void vscode.workspace
        .openTextDocument(vscode.Uri.file(configPath))
        .then((document) => vscode.window.showTextDocument(document, { preview: false }))
        .then(undefined, (err: any) => {
            vscode.window.showWarningMessage(`Could not open ${configPath}: ${err.message}`);
        });
}

export function ensureGuchhoConfig(serveDir: string, fileUri?: vscode.Uri): GuchhoConfigResult {
    const entries = scanHtmlFiles(serveDir);
    if (entries.length === 0) {
        throw new Error(
            'No HTML entry file found. Add an .html file to the project.'
        );
    }

    const outbase = commonDirectory(entries);
    const primary = findPrimary(entries, serveDir, fileUri);
    const existing = findConfigFile(serveDir);

    if (existing) {
        const parsed = readJsonConfig(existing);
        const build = parsed && typeof parsed === 'object' ? parsed.build : undefined;

        if (build && typeof build === 'object' && build.outdir === GENERATED_OUTDIR) {
            build.entry = entries;
            build.outbase = outbase;
            fs.writeFileSync(existing, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
            return { path: existing, created: false, updated: true, entries, outbase, primary };
        }

        return { path: existing, created: false, updated: false, entries, outbase, primary };
    }

    const configPath = path.join(serveDir, 'guchho.config.json');
    const config = {
        build: {
            entry: entries,
            outbase,
            outdir: GENERATED_OUTDIR
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    openConfigFile(configPath);

    return { path: configPath, created: true, updated: false, entries, outbase, primary };
}

export function urlPathForEntry(entry: string, outbase: string): string {
    let relative = entry;

    if (outbase !== '.' && entry.startsWith(`${outbase}/`)) {
        relative = entry.slice(outbase.length + 1);
    }

    if (relative.toLowerCase() === 'index.html') {
        return '/';
    }

    return '/' + relative.split('/').map(encodeURIComponent).join('/');
}
