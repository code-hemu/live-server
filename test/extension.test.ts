import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('codehemu.live-server'));
    });

    test('Should register commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('liveServerGuchho.startServer'));
        assert.ok(commands.includes('liveServerGuchho.stopServer'));
        assert.ok(commands.includes('liveServerGuchho.restartServer'));
        assert.ok(commands.includes('liveServerGuchho.openInBrowser'));
        assert.ok(commands.includes('liveServerGuchho.toggleServer'));
    });
});
