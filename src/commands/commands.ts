import * as vscode from 'vscode';
import { analyzeQuery, getLastErrorMessage } from '../services/analysisService';
import { getDryRunStats } from '../services/bigQueryService'; 
import { getConfiguration } from '../services/configurationService';
import { isEligibleForAnalysis } from '../utils/documentUtils';
import { hideResultStatusBar, isResultVisible, getResultTooltip, updateControlStatusBar } from '../ui/statusBarManager';

let isExtensionActive = false;

/**
 * Gets whether the extension is currently active
 * @returns Extension active state
 */
export function getExtensionActiveState(): boolean {
    return isExtensionActive;
}

/**
 * Sets the extension's active state
 * @param active Whether the extension should be active
 */
export function setExtensionActiveState(active: boolean): void {
    isExtensionActive = active;
    updateControlStatusBar(active);
}

/**
 * Command handler for start extension command
 */
export async function startExtensionHandler(): Promise<void> {
    isExtensionActive = true;
    updateControlStatusBar(true);
    
    // Auto-dismissing message using standard VS Code API
    // Use cancellable: false to show an "X" button instead of "Cancel"
    await vscode.window.withProgress(
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
        await analyzeQuery(editor.document, editor);
    }
}

/**
 * Command handler for pause extension command
 */
export async function pauseExtensionHandler(): Promise<void> {
    isExtensionActive = false;
    updateControlStatusBar(false);
    
    // Auto-dismissing message using standard VS Code API
    // Use cancellable: false to show an "X" button instead of "Cancel"
    await vscode.window.withProgress(
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
}

/**
 * Command handler for settings command
 */
export async function settingsHandler(): Promise<void> {
    // Open VS Code settings page filtered to show only BigQuery Previewer settings
    await vscode.commands.executeCommand('workbench.action.openSettings', 'bigqueryPreviewer');
}

/**
 * Command handler for analyze query command
 */
export async function analyzeQueryHandler(): Promise<void> {
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
        updateControlStatusBar(true);
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found. Please open a .sql file to analyze.');
        return;
    }

    await analyzeQuery(editor.document, editor);
}

/**
 * Command handler for showing result options
 */
export async function showResultOptionsHandler(): Promise<void> {
    // Create array for quick pick options
    const options = [];
    
    // Add the appropriate toggle option based on extension state
    if (isExtensionActive) {
        options.push({ label: '$(debug-pause) Pause', description: 'Pause BigQuery Previewer' });
    } else {
        options.push({ label: '$(debug-start) Start', description: 'Start BigQuery Previewer' });
    }
    
    // Only add hide option if the result bar is visible
    if (isResultVisible()) {
        options.push({ label: '$(eye-closed) Hide', description: 'Hide this result' });
    }

    // Add option to view full error message if available
    const lastFullErrorMessage = getLastErrorMessage();
    if (lastFullErrorMessage) {
        options.push({ label: '$(error) View Full Error', description: 'View the full error message' });
    }
    
    // Add option to view dry run tracking stats if enabled
    const config = getConfiguration();
    if (config.trackDryRuns) {
        options.push({ label: '$(graph) Dry Run Stats', description: 'View dry run tracking statistics' });
    }
    
    // Add option to open extension settings
    options.push({ label: '$(gear) Settings', description: 'Open BigQuery Previewer settings' });
    
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
            // Show the dry run stats directly instead of calling a separate command
            const stats = getDryRunStats();
            
            // Use the timestamps from getDryRunStats for consistent timing
            const currentTimeString = new Date(stats.currentTime).toLocaleTimeString();
            const lastTimeString = stats.lastRunTime ? new Date(stats.lastRunTime).toLocaleTimeString() : 'N/A';
            
            const message = `Dry Run Statistics:
- Total count: ${stats.count}
- Last run: ${lastTimeString}
- Current time: ${currentTimeString}
- Time since last run: ${stats.timeSinceLast}`;

            vscode.window.showInformationMessage(message, { modal: true });
        } else if (selected.label.includes('Settings')) {
            vscode.commands.executeCommand('bigquery-previewer.settings');
        }
    }
}