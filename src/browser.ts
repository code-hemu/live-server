import * as vscode from 'vscode';
import { LiveServer } from './server';

export class BrowserCommands {
    constructor(private server: LiveServer) {}

    public register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('liveServerGuchho.startServer', (uri?: vscode.Uri) => {
                this.server.start(uri instanceof vscode.Uri ? uri : undefined);
            }),
            vscode.commands.registerCommand('liveServerGuchho.stopServer', () => {
                this.server.stop();
            }),
            vscode.commands.registerCommand('liveServerGuchho.restartServer', () => {
                this.server.restart();
            }),
            vscode.commands.registerCommand('liveServerGuchho.openInBrowser', () => {
                this.server.openInBrowser();
            }),
            vscode.commands.registerCommand('liveServerGuchho.toggleServer', () => {
                this.server.toggle();
            })
        );
    }
}
