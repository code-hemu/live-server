import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { resolveBinary } from './runtime';
import { ensureGuchhoConfig, urlPathForEntry } from './guchho-config';
import * as path from 'path';

export class LiveServer implements vscode.Disposable {
    private process: ChildProcess | null = null;
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;
    private isRunning: boolean = false;
    private currentUrl: string | undefined;
    private currentPort: number | undefined;
    private currentTargetUri: vscode.Uri | undefined;

    constructor(private extensionPath?: string) {
        this.outputChannel = vscode.window.createOutputChannel('Live Server (Guchho)');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    public showStatusBar(): void {
        this.statusBarItem.show();
    }

    public start(targetUri?: vscode.Uri, forceOpen: boolean = false): void {
        if (this.isRunning) {
            vscode.window.showWarningMessage('Live Server is already running');
            return;
        }

        try {
            const config = vscode.workspace.getConfiguration('liveServerGuchho');
            const host = config.get<string>('host') || '127.0.0.1';
            const port = config.get<number>('port') || 5500;
            const root = config.get<string>('root') || '.';
            const openBrowser = forceOpen || config.get<boolean>('openBrowser') !== false;

            const runtimeInfo = resolveBinary(this.extensionPath);
            const target = this.resolveTarget(targetUri, root, host, port);
            const guchhoConfig = ensureGuchhoConfig(target.serveDir, target.fileUri);
            const targetUrl = this.resolveUrl(guchhoConfig, target);

            this.outputChannel.clear();
            this.outputChannel.show();
            this.outputChannel.appendLine(`Starting Live Server (Guchho) dev server on ${host}:${port}...`);
            this.outputChannel.appendLine(`Watching directory: ${target.serveDir}`);
            const configState = guchhoConfig.created ? ' (created)' : guchhoConfig.updated ? ' (updated)' : '';
            this.outputChannel.appendLine(`Using config: ${guchhoConfig.path}${configState}`);
            this.outputChannel.appendLine(`HTML entries: ${guchhoConfig.entries.join(', ')}`);
            this.outputChannel.appendLine(`Using binary: ${runtimeInfo.executablePath}`);

            const useGuchhoOpen = openBrowser && !target.fileUri;
            const args = ['dev', `--port=${port}`, `--host=${host}`];
            if (useGuchhoOpen) {
                args.push('--open');
            }

            this.outputChannel.appendLine(`Command: ${runtimeInfo.executablePath} ${args.join(' ')}`);
            this.outputChannel.appendLine('Live reload: enabled (Guchho dev server)');

            this.process = spawn(runtimeInfo.executablePath, args, {
                cwd: target.serveDir,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.process.stdout?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            this.process.stderr?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            this.process.on('error', (err) => {
                this.outputChannel.appendLine(`Error: ${err.message}`);
                vscode.window.showErrorMessage(`Failed to start Live Server: ${err.message}`);
                this.resetState();
            });

            this.process.on('close', (code) => {
                this.outputChannel.appendLine(`Server stopped with code ${code}`);
                this.resetState();
            });

            this.isRunning = true;
            this.currentUrl = targetUrl;
            this.currentPort = port;
            this.currentTargetUri = target.fileUri;
            this.updateStatusBar();
            vscode.window.showInformationMessage(`Live Server started on ${targetUrl}`);

            if (openBrowser && !useGuchhoOpen) {
                setTimeout(() => {
                    vscode.env.openExternal(vscode.Uri.parse(targetUrl));
                }, 1000);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to start Live Server: ${err.message}`);
            this.outputChannel.appendLine(`Error: ${err.message}`);
            this.resetState();
        }
    }

    public stop(): void {
        if (!this.isRunning || !this.process) {
            vscode.window.showWarningMessage('Live Server is not running');
            return;
        }

        this.outputChannel.appendLine('Stopping server...');
        const proc = this.process;
        this.resetState();
        proc.kill();
        vscode.window.showInformationMessage('Live Server stopped');
    }

    public toggle(): void {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start(this.getActiveHtmlUri());
        }
    }

    public restart(): void {
        const target = this.currentTargetUri;
        this.stop();
        setTimeout(() => this.start(target), 500);
    }

    public openInBrowser(): void {
        if (!this.isRunning || !this.currentUrl) {
            this.start(this.getActiveHtmlUri(), true);
            return;
        }
        vscode.env.openExternal(vscode.Uri.parse(this.currentUrl));
    }

    public dispose(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.isRunning = false;
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }

    private getActiveHtmlUri(): vscode.Uri | undefined {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'html') {
            return editor.document.uri;
        }
        return undefined;
    }

    private resolveTarget(targetUri: vscode.Uri | undefined, root: string, host: string, port: number) {
        const fileUri = targetUri && targetUri.scheme === 'file' ? targetUri : this.getActiveHtmlUri();
        const workspaceFolder = fileUri
            ? vscode.workspace.getWorkspaceFolder(fileUri)
            : vscode.workspace.workspaceFolders?.[0];

        const cwd = workspaceFolder
            ? workspaceFolder.uri.fsPath
            : fileUri
                ? path.dirname(fileUri.fsPath)
                : process.cwd();

        const baseDir = path.resolve(cwd, root);
        let serveDir = baseDir;

        if (fileUri) {
            const filePath = fileUri.fsPath;
            const relative = path.relative(baseDir, filePath);
            if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
                serveDir = path.dirname(filePath);
            }
        }

        const browserHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
        return {
            serveDir,
            fileUri,
            browserHost,
            port
        };
    }

    private resolveUrl(
        config: ReturnType<typeof ensureGuchhoConfig>,
        target: { serveDir: string; fileUri?: vscode.Uri; browserHost: string; port: number }
    ): string {
        let entry = config.primary;

        if (target.fileUri) {
            const relative = path.relative(target.serveDir, target.fileUri.fsPath);
            const relativeEntry = relative.split(path.sep).join('/');
            if (config.entries.includes(relativeEntry)) {
                entry = relativeEntry;
            }
        }

        const urlPath = entry ? urlPathForEntry(entry, config.outbase) : '/';
        return `http://${target.browserHost}:${target.port}${urlPath}`;
    }

    private updateStatusBar(): void {
        if (this.isRunning && this.currentUrl) {
            this.statusBarItem.text = `$(radio-tower) Port: ${this.currentPort}`;
            this.statusBarItem.tooltip = `Live Server running at ${this.currentUrl}\nClick to stop`;
        } else {
            this.statusBarItem.text = '$(radio-tower) Go Live';
            this.statusBarItem.tooltip = 'Click to start Live Server';
        }
        this.statusBarItem.command = 'liveServerGuchho.toggleServer';
        this.statusBarItem.show();
    }

    private resetState(): void {
        this.isRunning = false;
        this.currentUrl = undefined;
        this.currentPort = undefined;
        this.currentTargetUri = undefined;
        this.process = null;
        this.updateStatusBar();
    }
}
