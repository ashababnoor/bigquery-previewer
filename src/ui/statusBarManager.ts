import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | undefined;
let resultStatusBarItem: vscode.StatusBarItem | undefined;
let isResultStatusBarVisible = false;

/**
 * Create and initialize status bar items
 */
export function initializeStatusBar(): void {
    // Create main control status bar item
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }
    
    // Create result status bar item
    if (!resultStatusBarItem) {
        resultStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        resultStatusBarItem.command = 'bigquery-previewer.showOptions';
    }
}

/**
 * Updates the main control status bar with active/inactive state
 * @param isActive Whether the extension is currently active
 */
export function updateControlStatusBar(isActive: boolean): void {
    if (!statusBarItem) {
        initializeStatusBar();
    }
    
    if (statusBarItem) {
        if (isActive) {
            statusBarItem.text = "$(debug-pause) BigQuery Previewer";
            statusBarItem.tooltip = "Click to pause BigQuery Previewer";
            statusBarItem.command = 'bigquery-previewer.pauseExtension';
        } else {
            statusBarItem.text = "$(debug-start) BigQuery Previewer";
            statusBarItem.tooltip = "Click to activate BigQuery Previewer";
            statusBarItem.command = 'bigquery-previewer.startExtension';
        }
        
        statusBarItem.show();
    }
}

/**
 * Updates the result status bar with analysis results
 * @param message The message to display in the status bar
 * @param color The text color theme
 * @param backgroundColor Optional background color theme
 * @param tooltip Optional tooltip text
 */
export function updateStatusBar(
    message: string, 
    color: vscode.ThemeColor, 
    backgroundColor?: vscode.ThemeColor, 
    tooltip?: string
): void {
    if (!resultStatusBarItem) {
        initializeStatusBar();
    }
    
    if (resultStatusBarItem) {
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
}

/**
 * Hides the result status bar
 */
export function hideResultStatusBar(): void {
    if (resultStatusBarItem && isResultStatusBarVisible) {
        resultStatusBarItem.hide();
        isResultStatusBarVisible = false;
    }
}

/**
 * Checks if the result status bar is currently visible
 * @returns true if the result status bar is visible
 */
export function isResultVisible(): boolean {
    return isResultStatusBarVisible;
}

/**
 * Gets the current tooltip text of the result status bar
 * @returns The current tooltip text, or undefined if not available
 */
export function getResultTooltip(): string | undefined {
    return resultStatusBarItem?.tooltip?.toString();
}

/**
 * Dispose of status bar items
 */
export function disposeStatusBar(): void {
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
    
    if (resultStatusBarItem) {
        resultStatusBarItem.dispose();
        resultStatusBarItem = undefined;
    }
    
    isResultStatusBarVisible = false;
}