// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';

let statusBarItem: vscode.StatusBarItem;
let resultStatusBarItem: vscode.StatusBarItem; // New status bar item for displaying results
let isResultStatusBarVisible = false; // Track visibility state manually
let lastRunTime: number | null = null;
let isRunning = false;
const defaultWaitTimeUntilNextRun: number = 5000; // 5 seconds
const waitTimeUntilNextRunForOnChange: number = 10000; // 10 seconds for onChange event
const documentVersions = new Map<string, number>();
let changeDebounceTimer: NodeJS.Timeout | undefined;
let isExtensionActive = false; // Track if extension is active for analysis
let closingDocuments = new Set<string>(); // Track documents that are being closed
const savingDocuments = new Map<string, NodeJS.Timeout>(); // Track documents being saved to detect save-on-close
let lastFullErrorMessage: string | null = null; // Store the last full error message for viewing

// Dry run tracking
let dryRunCount: number = 0;
let lastDryRunTime: number | null = null;
let dryRunTrackingEnabled: boolean = false;

// Variables for selection analysis
const SELECTION_DELAY = 750; // 750ms delay before analyzing a selection
let selectionAnalysisTimer: NodeJS.Timeout | undefined; // Timer for delayed selection analysis
let lastSelection: { editor: vscode.TextEditor; selection: vscode.Selection; timestamp: number } | undefined; // Track last selection
let selectionTriggerCount = 0; // Count selection trigger events to prevent excessive analysis
const MAX_SELECTION_TRIGGERS = 5; // Maximum number of selection events allowed in quick succession
const SELECTION_TRIGGER_RESET_TIME = 1500; // Time in ms to reset the trigger count

/**
 * Formats data size in bytes to a human-readable string (KB, MB, GB, TB)
 * @param bytes The size in bytes to format
 * @returns A formatted string with appropriate unit (KB, MB, GB, TB)
 */
function formatDataSize(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const base = 1024;
    const decimals = 2;
    
    // Calculate the appropriate unit
    const i = Math.floor(Math.log(bytes) / Math.log(base));
    
    // Format with the appropriate unit and decimal places
    const size = parseFloat((bytes / Math.pow(base, i)).toFixed(decimals));
    
    return `${size} ${units[i]}`;
}

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

/**
 * Checks if a document is eligible for analysis (is a SQL file)
 * @param document The TextDocument to check
 * @returns true if the document is eligible for analysis (SQL file), false otherwise
 */
function isEligibleForAnalysis(document: vscode.TextDocument): boolean {
    return document.languageId === 'sql' || document.fileName.endsWith('.sql');
}

function updateStatusBar(message: string, color: vscode.ThemeColor, backgroundColor?: vscode.ThemeColor, tooltip?: string) {
    if (!resultStatusBarItem) {
        resultStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        resultStatusBarItem.command = 'bigquery-previewer.showResultOptions';
    }
    
    resultStatusBarItem.text = message;
    resultStatusBarItem.color = color;
    
    // Set the tooltip if provided
    if (tooltip) {
        resultStatusBarItem.tooltip = tooltip;
    } else {
        resultStatusBarItem.tooltip = message; // Default to the displayed message
    }
    
    // Set the background color if provided
    if (backgroundColor) {
        resultStatusBarItem.backgroundColor = backgroundColor;
    } else {
        resultStatusBarItem.backgroundColor = undefined; // Reset to default if not specified
    }
    
    // Make sure it's visible and update our tracking variable
    resultStatusBarItem.show();
    isResultStatusBarVisible = true;
}

function hideResultStatusBar() {
    if (resultStatusBarItem && isResultStatusBarVisible) {
        resultStatusBarItem.hide();
        isResultStatusBarVisible = false;
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
        trackDryRuns: config.get<boolean>('trackDryRuns', false),
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
    const config = getConfiguration();
    const currentTime = Date.now();
    
    // Track dry run statistics if enabled
    if (config.trackDryRuns) {
        dryRunCount++;
        const currentTimeString = new Date(currentTime).toLocaleTimeString();
        let timeDiff = 'N/A';
        
        if (lastDryRunTime !== null) {
            const diffMs = currentTime - lastDryRunTime;
            timeDiff = `${(diffMs / 1000).toFixed(2)}s`;
        }
        
        const lastTimeString = lastDryRunTime ? new Date(lastDryRunTime).toLocaleTimeString() : 'N/A';
        
        console.log(`[BigQuery Previewer] Dry Run #${dryRunCount} | Current: ${currentTimeString} | Last: ${lastTimeString} | Diff: ${timeDiff}`);
    }
    
    // Update last dry run time
    lastDryRunTime = currentTime;

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

async function analyzeQuery(document: vscode.TextDocument, editor?: vscode.TextEditor, waitTimeUntilNextRun?: number) {
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
	const waitTimeToUse = waitTimeUntilNextRun ?? defaultWaitTimeUntilNextRun;
	const waitTimeElapsed = lastRunTime && (currentTime - lastRunTime > waitTimeToUse);
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
    if (isEligibleForAnalysis(document)) {
        if (config.enableStatusBar) {
            updateStatusBar('Analyzing...', 
                new vscode.ThemeColor('statusBarItem.foreground'),
                new vscode.ThemeColor('statusBarItem.prominentBackground'));
        } else {
            vscode.window.showInformationMessage('Analyzing BigQuery SQL file...');
        }

        // Check if there's a selection in the editor
        let query = document.getText();
        let isSelectionAnalysis = false;
        
        // If editor is provided and has a non-empty selection, use the selected text
        if (editor && !editor.selection.isEmpty) {
            const selectedText = document.getText(editor.selection);
            if (selectedText.trim().length > 0) {
                query = selectedText;
                isSelectionAnalysis = true;
            }
        }

        const { scannedBytes, errors } = await performDryRun(query);

        if (errors.length > 0) {
            lastFullErrorMessage = errors.join('; ');
            const maxErrorLength = 50;
            const truncatedError = lastFullErrorMessage.length > maxErrorLength ? 
                lastFullErrorMessage.substring(0, maxErrorLength) + '...' : 
                lastFullErrorMessage;

            if (config.enableStatusBar) {
                updateStatusBar(`Error: ${truncatedError}`, 
                    new vscode.ThemeColor('statusBarItem.errorForeground'),
                    new vscode.ThemeColor('statusBarItem.errorBackground'),
                    lastFullErrorMessage // Pass full message as tooltip
                );
            } else {
                vscode.window.showErrorMessage(`Query analysis failed: ${lastFullErrorMessage}`);
            }
        } else {
            // No errors, proceed with success or warning message
            lastFullErrorMessage = null;
            
            const formattedScanSize = formatDataSize(scannedBytes);
            
            // Use MB for threshold comparison but display in appropriate unit
            const mbThresholdInBytes = config.scanWarningThresholdMB * 1024 * 1024;

            const selectionMsg = isSelectionAnalysis ? 'Selected text analysis' : 'Query analysis';
            const selectionPrefix = isSelectionAnalysis ? '$(selection) Selection: ' : '';
            
            if (config.showScanWarnings && scannedBytes > mbThresholdInBytes) {
                const fullWarningMessage = `${selectionMsg} successful. Estimated scan size: ${formattedScanSize} exceeds the threshold of ${formatDataSize(mbThresholdInBytes)}.`;
                const shortWarningMessage = `${selectionPrefix}$(warning) Scan: ${formattedScanSize} (Warning)`;
                
                if (config.enableStatusBar) {
                    updateStatusBar(
                        shortWarningMessage, 
                        new vscode.ThemeColor('statusBarItem.warningForeground'),
                        new vscode.ThemeColor('statusBarItem.warningBackground'),
                        fullWarningMessage // Pass full message as tooltip
                    );
                } else {
                    vscode.window.showWarningMessage(fullWarningMessage);
                }
            } else {
                const fullSuccessMessage = `${selectionMsg} successful. Estimated scan size: ${formattedScanSize}.`;
                const shortSuccessMessage = `${selectionPrefix}$(pass-filled) Scan: ${formattedScanSize}`;
                
                if (config.enableStatusBar) {
                    // Use consistent updateStatusBar function with green text
                    updateStatusBar(
                        shortSuccessMessage, 
                        new vscode.ThemeColor('bigqueryPreviewer.successForeground'),
                        undefined, // No background color
                        fullSuccessMessage // Pass full message as tooltip
                    );
                } else {
                    vscode.window.showInformationMessage(fullSuccessMessage);
                }
            }
        }
    }

    lastRunTime = Date.now();
    isRunning = false;
}

/**
 * Handles selection changes with a stabilization delay to prevent excessive analysis
 * Will only analyze a selection after it remains unchanged for SELECTION_DELAY milliseconds
 * @param editor The text editor with the selection change
 */
function handleSelectionChange(editor: vscode.TextEditor): void {
    if (!isExtensionActive || !editor || !isEligibleForAnalysis(editor.document)) {
        return;
    }
    
    const config = getConfiguration();
    if (!config.enableStatusBar && !config.enableNotifications) {
        return; // No feedback mechanism enabled
    }
    
    // Track selection trigger count to prevent excessive analysis
    selectionTriggerCount++;
    
    // If we've hit the limit, wait before enabling more triggers
    if (selectionTriggerCount > MAX_SELECTION_TRIGGERS) {
        console.log('Too many selection changes detected. Waiting before enabling more selection triggers.');
        setTimeout(() => {
            selectionTriggerCount = 0;
        }, SELECTION_TRIGGER_RESET_TIME);
        return;
    }
    
    // Cancel any pending selection analysis
    if (selectionAnalysisTimer) {
        clearTimeout(selectionAnalysisTimer);
        selectionAnalysisTimer = undefined;
    }
    
    // If selection is empty, don't schedule an analysis
    if (editor.selection.isEmpty) {
        lastSelection = undefined;
        return;
    }
    
    const currentSelection = editor.selection;
    const currentTime = Date.now();
    
    // Store current selection
    lastSelection = {
        editor,
        selection: currentSelection,
        timestamp: currentTime
    };
    
    // Schedule a new analysis after the stabilization delay
    selectionAnalysisTimer = setTimeout(async () => {
        // Verify the selection is still valid and unchanged
        const activeEditor = vscode.window.activeTextEditor;
        if (
            activeEditor &&
            activeEditor === lastSelection?.editor &&
            activeEditor.document === editor.document &&
            areSelectionsEqual(activeEditor.selection, lastSelection.selection)
        ) {
            await analyzeQuery(editor.document, editor);
        }
        selectionAnalysisTimer = undefined;
    }, SELECTION_DELAY);
}

/**
 * Compares two selections for equality
 * @param a First selection
 * @param b Second selection
 * @returns true if selections are equal, false otherwise
 */
function areSelectionsEqual(a: vscode.Selection, b: vscode.Selection): boolean {
    return (
        a.anchor.line === b.anchor.line &&
        a.anchor.character === b.anchor.character &&
        a.active.line === b.active.line &&
        a.active.character === b.active.character
    );
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
		
		// Auto-dismissing message using standard VS Code API
		// Use cancellable: false to show an "X" button instead of "Cancel"
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'BigQuery Previewer is now active. SQL files will be automatically analyzed.',
				cancellable: false
			},
			async (progress) => {
				// Auto-dismiss after 3 seconds
				await new Promise(resolve => setTimeout(resolve, 3000));
				return;
			}
		);
		
		// Trigger analysis of current file if it's SQL
		const editor = vscode.window.activeTextEditor;
		if (editor && isEligibleForAnalysis(editor.document)) {
			analyzeQuery(editor.document, editor);
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
		
		// Auto-dismissing message using standard VS Code API
		// Use cancellable: false to show an "X" button instead of "Cancel"
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'BigQuery Previewer is now paused. No automatic analysis will occur.',
				cancellable: false
			},
			async (progress) => {
				// Auto-dismiss after 3 seconds
				await new Promise(resolve => setTimeout(resolve, 3000));
				return;
			}
		);
	});
	
	const showResultOptionsCommand = vscode.commands.registerCommand('bigquery-previewer.showResultOptions', async () => {
		// Create array for quick pick options
		const options = [];
		
		// Add the appropriate toggle option based on extension state
		if (isExtensionActive) {
			options.push({ label: '$(debug-pause) Pause', description: 'Pause BigQuery Previewer' });
		} else {
			options.push({ label: '$(debug-start) Start', description: 'Start BigQuery Previewer' });
		}
		
		// Only add hide option if the result bar is visible
		if (isResultStatusBarVisible) {
			options.push({ label: '$(eye-closed) Hide', description: 'Hide this result' });
		}

        // Add option to view full error message if available
        if (lastFullErrorMessage) {
            options.push({ label: '$(error) View Full Error', description: 'View the full error message' });
        }
        
        // Add option to view dry run tracking stats if enabled
        const config = getConfiguration();
        if (config.trackDryRuns) {
            options.push({ label: '$(graph) Dry Run Stats', description: 'View dry run tracking statistics' });
        }
		
		// Show the quick pick with available options
		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select an action for BigQuery Previewer'
		});
		
		if (selected) {
			if (selected.label.includes('Pause')) {
				vscode.commands.executeCommand('bigquery-previewer.pauseExtension');
			} else if (selected.label.includes('Start')) {
				vscode.commands.executeCommand('bigquery-previewer.startExtension');
			} else if (selected.label.includes('Hide')) {
				hideResultStatusBar();
			} else if (selected.label.includes('View Full Error')) {
                vscode.window.showErrorMessage(lastFullErrorMessage || 'No error message available.');
            } else if (selected.label.includes('Dry Run Stats')) {
                vscode.commands.executeCommand('bigquery-previewer.showDryRunStats');
            }
		}
	});

    // Add command to show dry run tracking statistics
    const showDryRunStatsCommand = vscode.commands.registerCommand('bigquery-previewer.showDryRunStats', () => {
        const currentTime = new Date().toLocaleTimeString();
        let timeDiff = 'N/A';
        
        if (lastDryRunTime !== null) {
            const diffMs = Date.now() - lastDryRunTime;
            timeDiff = `${(diffMs / 1000).toFixed(2)}s`;
        }
        
        const lastTimeString = lastDryRunTime ? new Date(lastDryRunTime).toLocaleTimeString() : 'N/A';
        
        const message = `Dry Run Statistics:
- Total count: ${dryRunCount}
- Last run: ${lastTimeString}
- Current time: ${currentTime}
- Time since last run: ${timeDiff}`;

        vscode.window.showInformationMessage(message, { modal: true });
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

		await analyzeQuery(editor.document, editor);
	});

	// Add selection change event listener
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(event => {
			handleSelectionChange(event.textEditor);
		})
	);

	context.subscriptions.push(
		startExtensionCommand,
		pauseExtensionCommand,
		showResultOptionsCommand,
        showDryRunStatsCommand,
		analyzeQueryCommand
	);

	// Better file close detection
	// 1. Listen for will-save events to detect potential save-on-close operations
	context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((e) => {
		const uri = e.document.uri.toString();
		// When a document is about to be saved, mark it as potentially closing
		// and start a short timeout
		if (isEligibleForAnalysis(e.document)) {
			// Clear any existing timer
			const existingTimer = savingDocuments.get(uri);
			if (existingTimer) {
				clearTimeout(existingTimer);
			}
			
			// Add to potentially closing documents
			const timer = setTimeout(() => {
				savingDocuments.delete(uri);
				// If this document is still open after our timeout, it wasn't a save-on-close
			}, 300); // Short timeout to detect save-on-close pattern
			
			savingDocuments.set(uri, timer);
		}
	}));
	
	// 2. Listen for document close events to identify definite closures
	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
		const uri = document.uri.toString();
		
		// If this document was recently saved, it's likely a save-on-close operation
		if (savingDocuments.has(uri)) {
			// Add to our closing documents set to prevent analysis
			closingDocuments.add(uri);
			
			// Clear the saving timer
			const timer = savingDocuments.get(uri);
			if (timer) {
				clearTimeout(timer);
			}
			savingDocuments.delete(uri);
			
			console.log('Detected save-on-close for document:', uri);
			
			// Keep in the closing set a bit longer to catch any pending save operations
			setTimeout(() => {
				closingDocuments.delete(uri);
			}, 1000); 
		}
	}));

	// Event listener for file save (auto analysis if enabled and extension is active)
	vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!isExtensionActive) return;
        
        // Skip analysis if this document is being closed or was recently in a save operation
        const documentUri = document.uri.toString();
        if (closingDocuments.has(documentUri) || savingDocuments.has(documentUri)) {
            console.log('Skipping analysis for document being closed or in save-on-close operation:', documentUri);
            return;
        }
        
        const config = getConfiguration();
        if (config.autoRunOnSave) {
            // Get the editor for the saved document
            const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === document.uri.toString());
            
            // Only analyze if we can find the editor (another indicator the file isn't being closed)
            if (editor) {
                await analyzeQuery(document, editor);
            }
        }
    });
    
    // Event listener for file change (auto analysis if enabled and extension is active)
    vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (!isExtensionActive) return;
        
        const config = getConfiguration();
        if (config.autoRunOnChange && isEligibleForAnalysis(event.document)) {
            // Clear any existing timer to implement debouncing
            if (changeDebounceTimer) {
                clearTimeout(changeDebounceTimer);
            }
            
            // Set a new timer using the configured debounce delay
            changeDebounceTimer = setTimeout(async () => {
                // Get the editor for the changed document
                const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === event.document.uri.toString());
                await analyzeQuery(event.document, editor, waitTimeUntilNextRunForOnChange);
                // Clear the timer reference once executed
                changeDebounceTimer = undefined;
            }, config.changeDebounceDelayMs);
        }
    });
    
    // Event listener for file open (auto analysis if enabled and extension is active)
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (!isExtensionActive) return;
        
        const config = getConfiguration();
        if (config.autoRunOnOpen && isEligibleForAnalysis(document)) {
            // Get the editor for the opened document
            const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === document.uri.toString());
            await analyzeQuery(document, editor);
        }
    });

    // Event listener for selection change
    vscode.window.onDidChangeTextEditorSelection((event) => {
        handleSelectionChange(event.textEditor);
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
