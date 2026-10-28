import * as vscode from 'vscode';
import { LiveServer } from './server';
import { BrowserCommands } from './browser';

let server: LiveServer | undefined;

export function activate(context: vscode.ExtensionContext) {
    server = new LiveServer(context.extensionPath);
    const commands = new BrowserCommands(server);
    commands.register(context);
    context.subscriptions.push(server);
    server.showStatusBar();
}

export function deactivate() {
    server = undefined;
}
