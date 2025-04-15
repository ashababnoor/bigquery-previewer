import * as vscode from 'vscode';
import { performDryRun } from './bigQueryService';
import { getConfiguration } from './configurationService';
import { updateStatusBar } from '../ui/statusBarManager';
import { isEligibleForAnalysis, hasDocumentChanged } from '../utils/documentUtils';
import { formatDataSize } from '../utils/formatters';

// Analysis state tracking
let isRunning = false;
let lastRunTime: number | null = null;
let lastFullErrorMessage: string | null = null;

// Constants for timing
const defaultWaitTimeUntilNextRun: number = 5000; // 5 seconds
const waitTimeUntilNextRunForOnChange: number = 10000; // 10 seconds for onChange event

/**
 * Analyzes a SQL query for BigQuery scanning impact
 * @param document The document containing the query to analyze
 * @param editor Optional editor to analyze selection within document
 * @param waitTimeUntilNextRun Optional override for the minimum time between analyses
 */
export async function analyzeQuery(
    document: vscode.TextDocument, 
    editor?: vscode.TextEditor, 
    waitTimeUntilNextRun?: number
): Promise<void> {
    // Guard clause to check if the document is available
    if (!document) {
        vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
        return;
    }

    // Prevent concurrent execution - if an analysis is already running, skip this one
    if (isRunning) {
        console.log('Analysis already in progress, skipping.');
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

    // Mark as running to prevent concurrent execution
    isRunning = true;
    
    try {
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
                    // Make status bar more informative by including threshold information
                    const shortWarningMessage = `${selectionPrefix}$(warning) Scan: ${formattedScanSize} (> ${formatDataSize(mbThresholdInBytes)})`;
                    
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
    } finally {
        // Always reset running state even if an error occurs
        isRunning = false;
    }
}

/**
 * Gets the last error message from query analysis
 * @returns The last error message or null if no errors
 */
export function getLastErrorMessage(): string | null {
    return lastFullErrorMessage;
}

/**
 * Resets the error message state 
 */
export function resetErrorMessage(): void {
    lastFullErrorMessage = null;
}

/**
 * Gets the last run time of query analysis
 * @returns The timestamp of the last analysis run or null
 */
export function getLastRunTime(): number | null {
    return lastRunTime;
}

/**
 * Resets the analysis state
 */
export function resetAnalysisState(): void {
    lastRunTime = null;
    lastFullErrorMessage = null;
    isRunning = false;
}