// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';

let statusBarItem: vscode.StatusBarItem;

function updateStatusBar(message: string, color: vscode.ThemeColor) {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.show();
    }
    statusBarItem.text = message;
    statusBarItem.color = color;
}

function getConfiguration() {
    const config = vscode.workspace.getConfiguration('bigqueryPreviewer');
    return {
        authMode: config.get<string>('authMode', 'adc'),
        serviceAccountKeyPath: config.get<string>('serviceAccountKeyPath', ''),
        scanWarningThresholdMB: config.get<number>('scanWarningThresholdMB', 100),
        autoRunOnSave: config.get<boolean>('autoRunOnSave', true),
        enableStatusBar: config.get<boolean>('enableStatusBar', true),
        enableNotifications: config.get<boolean>('enableNotifications', false),
        showScanWarnings: config.get<boolean>('showScanWarnings', true),
    };
}

async function initializeBigQueryClient(): Promise<BigQuery> {
    const config = getConfiguration();

    if (config.authMode === 'service_account' && config.serviceAccountKeyPath) {
        return new BigQuery({
            keyFilename: config.serviceAccountKeyPath
        });
    }

    // Default to ADC if no service account is configured
    return new BigQuery();
}

export async function performDryRun(query: string): Promise<{ scannedBytes: number; errors: string[] }> {
    const bigquery = await initializeBigQueryClient();

    try {
        const [job] = await bigquery.createQueryJob({
            query,
            dryRun: true
        });

        const scannedBytes = parseInt(job.metadata.statistics?.totalBytesProcessed || '0', 10);
        return { scannedBytes, errors: [] };
    } catch (error: any) {
        const errors = error.errors?.map((e: any) => e.message) || [error.message];
        return { scannedBytes: 0, errors };
    }
}

async function analyzeQuery(document: vscode.TextDocument) {
    const config = getConfiguration();
    if (document.languageId === 'sql' || document.fileName.endsWith('.sql')) {
        if (config.enableStatusBar) {
            updateStatusBar('Analyzing...', new vscode.ThemeColor('statusBarItem.foreground'));
        } else {
            vscode.window.showInformationMessage('Analyzing BigQuery SQL file...');
        }

        const query = document.getText();
        const { scannedBytes, errors } = await performDryRun(query);

        if (errors.length > 0) {
            if (config.enableStatusBar) {
                updateStatusBar('Error in query analysis', new vscode.ThemeColor('statusBarItem.errorForeground'));
            } else {
                vscode.window.showErrorMessage(`Query analysis failed: ${errors.join('; ')}`);
            }
        } else {
            const scannedMB = (scannedBytes / (1024 * 1024)).toFixed(2);

            if (config.showScanWarnings && scannedBytes > config.scanWarningThresholdMB * 1024 * 1024) {
                if (config.enableStatusBar) {
                    updateStatusBar(`Scan size: ${scannedMB} MB (Warning)`, new vscode.ThemeColor('statusBarItem.warningForeground'));
                } else {
                    vscode.window.showWarningMessage(`Query analysis successful. Estimated scan size: ${scannedMB} MB exceeds the threshold.`);
                }
            } else {
                if (config.enableStatusBar) {
                    updateStatusBar(`Scan size: ${scannedMB} MB`, new vscode.ThemeColor('statusBarItem.foreground'));
                } else {
                    vscode.window.showInformationMessage(`Query analysis successful. Estimated scan size: ${scannedMB} MB.`);
                }
            }
        }
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "bigquery-previewer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	// Register the command for manual analysis
	const analyzeQueryCommand = vscode.commands.registerCommand('bigquery-previewer.analyzeQuery', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
			return;
		}

		await analyzeQuery(editor.document);
	});

	context.subscriptions.push(analyzeQueryCommand);

	// Event listener for file save (auto analysis if enabled)
	vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = getConfiguration();
        if (config.autoRunOnSave) {
            await analyzeQuery(document);
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
