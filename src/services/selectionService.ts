import * as vscode from 'vscode';
import { areSelectionsEqual, isEligibleForAnalysis } from '../utils/documentUtils';
import { getConfiguration } from './configurationService';
import { analyzeQuery } from './analysisService';

// Variables for selection analysis
const selectionStabilizationDelay = 750; // 750ms delay before analyzing a selection
let selectionAnalysisTimer: NodeJS.Timeout | undefined; // Timer for delayed selection analysis
let lastSelection: { editor: vscode.TextEditor; selection: vscode.Selection; timestamp: number } | undefined; // Track last selection
let selectionTriggerCount = 0; // Count selection trigger events to prevent excessive analysis
const maxSelectionTriggers = 5; // Maximum number of selection events allowed in quick succession
const selectionTriggerResetTime = 1500; // Time in ms to reset the trigger count

/**
 * Handles selection changes with a stabilization delay to prevent excessive analysis
 * Will only analyze a selection after it remains unchanged for selectionStabilizationDelay milliseconds
 * @param editor The text editor with the selection change
 * @param isExtensionActive Whether the extension is currently active
 */
export function handleSelectionChange(editor: vscode.TextEditor, isExtensionActive: boolean): void {
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
    if (selectionTriggerCount > maxSelectionTriggers) {
        console.log('Too many selection changes detected. Waiting before enabling more selection triggers.');
        setTimeout(() => {
            selectionTriggerCount = 0;
        }, selectionTriggerResetTime);
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
    }, selectionStabilizationDelay);
}

/**
 * Clean up selection analysis resources
 */
export function cleanupSelectionResources(): void {
    // Clear pending timers
    if (selectionAnalysisTimer) {
        clearTimeout(selectionAnalysisTimer);
        selectionAnalysisTimer = undefined;
    }
    
    // Reset state
    lastSelection = undefined;
    selectionTriggerCount = 0;
}