const vscode = require('vscode');

let focusedRoot = null;

class FocusedTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async getTreeItem(uri) {
        const stat = await vscode.workspace.fs.stat(uri);
        const isDirectory = stat.type === vscode.FileType.Directory;

        const item = new vscode.TreeItem(
            uri.path.split('/').pop(),
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        item.resourceUri = uri;

        if (!isDirectory) {
            item.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [uri],
            };
        }

        return item;
    }

    async getChildren(element) {
        if (!focusedRoot) return [];

        const folder = element || focusedRoot;
        const entries = await vscode.workspace.fs.readDirectory(folder);

        return entries.map(([name]) => vscode.Uri.joinPath(folder, name));
    }
}

function activate(context) {
    const provider = new FocusedTreeProvider();

    vscode.window.registerTreeDataProvider('focusedExplorer', provider);

    context.subscriptions.push(
        vscode.commands.registerCommand('focusedExplorer.focus', (uri) => {
            focusedRoot = uri;
            provider.refresh();
        })
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
