// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "bigquery-previewer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('bigquery-previewer.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from BigQuery Previewer!');
	});

	context.subscriptions.push(disposable);

	// Register the command for manual analysis
	const analyzeQueryCommand = vscode.commands.registerCommand('bigquery-previewer.analyzeQuery', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
			return;
		}

		const document = editor.document;
		if (document.languageId !== 'sql') {
			vscode.window.showErrorMessage('The active file is not a .sql file.');
			return;
		}

		vscode.window.showInformationMessage('Analyzing BigQuery SQL file...');
		// Placeholder for dry run logic
	});

	context.subscriptions.push(analyzeQueryCommand);

	// Event listener for file save (auto analysis if enabled)
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.languageId === 'sql') {
			vscode.window.showInformationMessage('Auto-analyzing BigQuery SQL file on save...');
			// Placeholder for auto-analysis logic
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
