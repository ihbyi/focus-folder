const vscode = require('vscode');
const path = require('path');

let focusedRoot = null;
let watcher = null;
let treeView = null;

class FocusedTreeProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async getTreeItem(element) {
        const stat = await vscode.workspace.fs.stat(element.uri);
        const isDirectory = stat.type === vscode.FileType.Directory;

        const item = new vscode.TreeItem(
            path.basename(element.uri.fsPath),
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        item.resourceUri = element.uri;

        if (!isDirectory) {
            item.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [element.uri],
            };
        }

        return item;
    }

    async getChildren(element) {
        if (!focusedRoot) return [];

        const folder = element ? element.uri : focusedRoot;
        const entries = await vscode.workspace.fs.readDirectory(folder);

        entries.sort((a, b) => {
            const [nameA, typeA] = a;
            const [nameB, typeB] = b;

            if (typeA !== typeB) {
                return typeA === vscode.FileType.Directory ? -1 : 1;
            }

            return nameA.localeCompare(nameB, undefined, {
                sensitivity: 'base',
            });
        });

        return entries.map(([name]) => ({
            uri: vscode.Uri.joinPath(folder, name),
        }));
    }
}

function updateViewTitle() {
    if (!treeView) return;
    treeView.title = focusedRoot
        ? path.basename(focusedRoot.fsPath)
        : 'Focused Folder';
}

function setWatcher(provider) {
    if (watcher) watcher.dispose();

    watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(focusedRoot, '**/*')
    );

    watcher.onDidChange(() => provider.refresh());
    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
}

function activate(context) {
    const saved = context.workspaceState.get('focusedRoot');
    if (saved) focusedRoot = vscode.Uri.parse(saved);

    const provider = new FocusedTreeProvider(context);

    treeView = vscode.window.createTreeView('focusedExplorer', {
        treeDataProvider: provider,
    });
    context.subscriptions.push(treeView);
    updateViewTitle();

    if (focusedRoot) setWatcher(provider);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'focusedExplorer.focus',
            async (uri) => {
                focusedRoot = uri;
                context.workspaceState.update('focusedRoot', uri.toString());
                setWatcher(provider);
                provider.refresh();
                updateViewTitle();

                await vscode.commands.executeCommand(
                    'workbench.view.extension.focusedFolderContainer'
                );
            }
        ),

        vscode.commands.registerCommand('focusedExplorer.clear', () => {
            focusedRoot = null;
            context.workspaceState.update('focusedRoot', null);
            if (watcher) watcher.dispose();
            provider.refresh();
            updateViewTitle();
        }),

        vscode.commands.registerCommand('focusedExplorer.presets', async () => {
            const folders = vscode.workspace.workspaceFolders || [];
            const root = folders[0]?.uri;
            if (!root) return;

            const entries = await vscode.workspace.fs.readDirectory(root);
            const presets = entries
                .filter(([_, type]) => type === vscode.FileType.Directory)
                .map(([name]) => name);

            const picked = await vscode.window.showQuickPick(presets);
            if (!picked) return;

            focusedRoot = vscode.Uri.joinPath(root, picked);
            context.workspaceState.update(
                'focusedRoot',
                focusedRoot.toString()
            );
            setWatcher(provider);
            provider.refresh();
            updateViewTitle();

            await vscode.commands.executeCommand(
                'workbench.view.extension.focusedFolderContainer'
            );
        })
    );
}

function deactivate() {
    focusedRoot = null;
}

module.exports = {
    activate,
    deactivate,
};
