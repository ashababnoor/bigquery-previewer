// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';

let statusBarItem: vscode.StatusBarItem;
let resultStatusBarItem: vscode.StatusBarItem; // New status bar item for displaying results
let lastRunTime: number | null = null;
let isRunning = false;
let waitTimeUntilNextRun: number = 5000; // 5 seconds
const documentVersions = new Map<string, number>();
let changeDebounceTimer: NodeJS.Timeout | undefined;
let isExtensionActive = false; // Track if extension is active for analysis

/**
 * Checks if the document has changed since last check (edited, saved, etc.)
 * @param document The TextDocument to check
 * @returns true if changed since last check, false otherwise
 */
export function hasDocumentChanged(document: vscode.TextDocument): boolean {
	const uri = document.uri.toString();
	const currentVersion = document.version;
  
	if (documentVersions.get(uri) === currentVersion) {
	  return false; // No change
	}
  
	documentVersions.set(uri, currentVersion);
	return true; // Change detected
}

function updateStatusBar(message: string, color: vscode.ThemeColor, backgroundColor?: vscode.ThemeColor) {
    if (!resultStatusBarItem) {
        resultStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        resultStatusBarItem.command = 'bigquery-previewer.showResultOptions';
        resultStatusBarItem.show();
    }
    resultStatusBarItem.text = message;
    resultStatusBarItem.color = color;
    
    // Set the background color if provided
    if (backgroundColor) {
        resultStatusBarItem.backgroundColor = backgroundColor;
    } else {
        resultStatusBarItem.backgroundColor = undefined; // Reset to default if not specified
    }
}

function hideResultStatusBar() {
    if (resultStatusBarItem) {
        resultStatusBarItem.hide();
    }
}

function updateControlStatusBar() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.show();
    }
    
    if (isExtensionActive) {
        statusBarItem.text = "$(debug-pause) BigQuery Previewer";
        statusBarItem.tooltip = "Click to pause BigQuery Previewer";
        statusBarItem.command = 'bigquery-previewer.pauseExtension';
    } else {
        statusBarItem.text = "$(debug-start) BigQuery Previewer";
        statusBarItem.tooltip = "Click to activate BigQuery Previewer";
        statusBarItem.command = 'bigquery-previewer.startExtension';
    }
}

function getConfiguration() {
    const config = vscode.workspace.getConfiguration('bigqueryPreviewer');
    return {
        authMode: config.get<string>('authMode', 'adc'),
        serviceAccountKeyPath: config.get<string>('serviceAccountKeyPath', ''),
        scanWarningThresholdMB: config.get<number>('scanWarningThresholdMB', 100),
        autoRunOnSave: config.get<boolean>('autoRunOnSave', true),
        autoRunOnChange: config.get<boolean>('autoRunOnChange', true),
        autoRunOnOpen: config.get<boolean>('autoRunOnOpen', true),
        enableStatusBar: config.get<boolean>('enableStatusBar', true),
        enableNotifications: config.get<boolean>('enableNotifications', false),
        showScanWarnings: config.get<boolean>('showScanWarnings', true),
        changeDebounceDelayMs: config.get<number>('changeDebounceDelayMs', 1500),
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
	// Check if extension is active
	if (!isExtensionActive) {
		// Don't perform analysis if extension is paused
		return;
	}

	// Guard clause to check if the document is available
	if (!document) {
		vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
		return;
	}

	const config = getConfiguration();
    const currentTime = Date.now();
	const waitTimeElapsed = lastRunTime && (currentTime - lastRunTime > waitTimeUntilNextRun);
	const isDocumentChanged = hasDocumentChanged(document);

	if (!waitTimeElapsed && !isDocumentChanged) {
		console.log('Skipping analysis as wait time has not elapsed and document has not changed.');
		return;
	}

	if (!config.enableStatusBar && !config.enableNotifications) {
		vscode.window.showWarningMessage('Both status bar and notifications are disabled. Please enable at least one to receive feedback. Query analysis not performed.');
		return;
	}

    isRunning = true;
    if (document.languageId === 'sql' || document.fileName.endsWith('.sql')) {
        if (config.enableStatusBar) {
            updateStatusBar('Analyzing...', 
                new vscode.ThemeColor('statusBarItem.foreground'),
                new vscode.ThemeColor('statusBarItem.prominentBackground'));
        } else {
            vscode.window.showInformationMessage('Analyzing BigQuery SQL file...');
        }

        const query = document.getText();
        const { scannedBytes, errors } = await performDryRun(query);

        if (errors.length > 0) {
            if (config.enableStatusBar) {
                updateStatusBar(`Error: ${errors.join('; ')}`, 
                    new vscode.ThemeColor('statusBarItem.errorForeground'),
                    new vscode.ThemeColor('statusBarItem.errorBackground'));
            } else {
                vscode.window.showErrorMessage(`Query analysis failed: ${errors.join('; ')}`);
            }
        } else {
            const scannedMB = (scannedBytes / (1024 * 1024)).toFixed(2);

            if (config.showScanWarnings && scannedBytes > config.scanWarningThresholdMB * 1024 * 1024) {
                if (config.enableStatusBar) {
                    updateStatusBar(`$(warning) Scan: ${scannedMB} MB (Warning)`, 
                        new vscode.ThemeColor('statusBarItem.warningForeground'),
                        new vscode.ThemeColor('statusBarItem.warningBackground'));
                } else {
                    vscode.window.showWarningMessage(`Query analysis successful. Estimated scan size: ${scannedMB} MB exceeds the threshold.`);
                }
            } else {
                if (config.enableStatusBar) {
                    // Use consistent updateStatusBar function with green text
                    updateStatusBar(`$(pass-filled) Scan: ${scannedMB} MB`, 
                        new vscode.ThemeColor('bigqueryPreviewer.successForeground'));
                } else {
                    vscode.window.showInformationMessage(`Query analysis successful. Estimated scan size: ${scannedMB} MB.`);
                }
            }
        }
    }

    lastRunTime = Date.now();
    isRunning = false;
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bigquery-previewer" is now active!');

	// Initialize status bar in inactive state
	isExtensionActive = false;
	updateControlStatusBar();

	// Register commands
	const startExtensionCommand = vscode.commands.registerCommand('bigquery-previewer.startExtension', () => {
		isExtensionActive = true;
		updateControlStatusBar();
		vscode.window.showInformationMessage('BigQuery Previewer is now active. SQL files will be automatically analyzed.');
		
		// Trigger analysis of current file if it's SQL
		const editor = vscode.window.activeTextEditor;
		if (editor && (editor.document.languageId === 'sql' || editor.document.fileName.endsWith('.sql'))) {
			analyzeQuery(editor.document);
		}
	});
	
	const pauseExtensionCommand = vscode.commands.registerCommand('bigquery-previewer.pauseExtension', () => {
		isExtensionActive = false;
		updateControlStatusBar();
		
		// Clear any pending analysis timers when pausing
		if (changeDebounceTimer) {
			clearTimeout(changeDebounceTimer);
			changeDebounceTimer = undefined;
		}
		
		vscode.window.showInformationMessage('BigQuery Previewer is now paused. No automatic analysis will occur.');
	});
	
	const showResultOptionsCommand = vscode.commands.registerCommand('bigquery-previewer.showResultOptions', async () => {
		const selected = await vscode.window.showQuickPick([
			{ label: '$(debug-pause) Pause', description: 'Pause BigQuery Previewer' },
			{ label: '$(eye-closed) Hide', description: 'Hide this result' }
		], {
			placeHolder: 'Select an action for BigQuery Previewer'
		});
		
		if (selected) {
			if (selected.label.includes('Pause')) {
				vscode.commands.executeCommand('bigquery-previewer.pauseExtension');
			} else if (selected.label.includes('Hide')) {
				hideResultStatusBar();
			}
		}
	});
	
	const analyzeQueryCommand = vscode.commands.registerCommand('bigquery-previewer.analyzeQuery', async () => {
		// If extension is paused, prompt to activate it
		if (!isExtensionActive) {
			const action = await vscode.window.showInformationMessage(
				'BigQuery Previewer is paused. Do you want to activate it and analyze the current query?',
				'Activate', 'Cancel'
			);
			
			if (action !== 'Activate') {
				return;
			}
			
			isExtensionActive = true;
			updateControlStatusBar();
		}
		
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
			return;
		}

		await analyzeQuery(editor.document);
	});

	context.subscriptions.push(
		startExtensionCommand,
		pauseExtensionCommand,
		showResultOptionsCommand,
		analyzeQueryCommand
	);

	// Event listener for file save (auto analysis if enabled and extension is active)
	vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!isExtensionActive) return;
        
        const config = getConfiguration();
        if (config.autoRunOnSave) {
            await analyzeQuery(document);
        }
    });
    
    // Event listener for file change (auto analysis if enabled and extension is active)
    vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (!isExtensionActive) return;
        
        const config = getConfiguration();
        if (config.autoRunOnChange && (event.document.languageId === 'sql' || event.document.fileName.endsWith('.sql'))) {
            // Clear any existing timer to implement debouncing
            if (changeDebounceTimer) {
                clearTimeout(changeDebounceTimer);
            }
            
            // Set a new timer using the configured debounce delay
            changeDebounceTimer = setTimeout(async () => {
                await analyzeQuery(event.document);
                // Clear the timer reference once executed
                changeDebounceTimer = undefined;
            }, config.changeDebounceDelayMs);
        }
    });
    
    // Event listener for file open (auto analysis if enabled and extension is active)
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (!isExtensionActive) return;
        
        const config = getConfiguration();
        if (config.autoRunOnOpen && (document.languageId === 'sql' || document.fileName.endsWith('.sql'))) {
            await analyzeQuery(document);
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Dispose of the status bar items to prevent memory leaks
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    if (resultStatusBarItem) {
        resultStatusBarItem.dispose();
    }
}
