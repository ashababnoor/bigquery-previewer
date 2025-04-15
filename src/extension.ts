// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { analyzeQuery, resetAnalysisState } from './services/analysisService';
import { updateTrackingSettings, resetDryRunTracking } from './services/bigQueryService';
import { isEligibleForAnalysis, removeDocumentFromCache } from './utils/documentUtils';
import { handleSelectionChange, cleanupSelectionResources } from './services/selectionService';
import { getConfiguration } from './services/configurationService';
import { 
    startExtensionHandler, 
    pauseExtensionHandler,
    analyzeQueryHandler, 
    showOptionsHandler,
    getExtensionActiveState,
    settingsHandler
} from './commands/commands';
import { initializeStatusBar, disposeStatusBar } from './ui/statusBarManager';
import { clearDocumentVersionCache } from './utils/documentUtils';

// Track documents that are being closed or saved
let closingDocuments = new Set<string>();
const savingDocuments = new Map<string, NodeJS.Timeout>();
let changeDebounceTimer: NodeJS.Timeout | undefined;
const waitTimeUntilNextRunForOnChange = 10000; // 10 seconds for onChange event

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "bigquery-previewer" is now active!');

    // Initialize services
    initializeStatusBar();
    updateTrackingSettings();

    // Register commands with their handlers
    const startExtensionCommand = vscode.commands.registerCommand('bigquery-previewer.startExtension', startExtensionHandler);
    const pauseExtensionCommand = vscode.commands.registerCommand('bigquery-previewer.pauseExtension', pauseExtensionHandler);
    const showOptionsCommand = vscode.commands.registerCommand('bigquery-previewer.showOptions', showOptionsHandler);
    const analyzeQueryCommand = vscode.commands.registerCommand('bigquery-previewer.analyzeQuery', analyzeQueryHandler);
    const settingsCommand = vscode.commands.registerCommand('bigquery-previewer.settings', settingsHandler);

    // Register commands with context subscriptions for proper disposal
    context.subscriptions.push(
        startExtensionCommand,
        pauseExtensionCommand,
        showOptionsCommand,
        analyzeQueryCommand,
        settingsCommand
    );

    // Add selection change event listener
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            handleSelectionChange(event.textEditor, getExtensionActiveState());
        })
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
        
        // Clean up document from cache to prevent memory leaks
        removeDocumentFromCache(uri);
        
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
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!getExtensionActiveState()) return;
        
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
    }));
    
    // Event listener for file change (auto analysis if enabled and extension is active)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (!getExtensionActiveState()) return;
        
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
    }));
    
    // Event listener for file open (auto analysis if enabled and extension is active)
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (!getExtensionActiveState()) return;
        
        const config = getConfiguration();
        if (config.autoRunOnOpen && isEligibleForAnalysis(document)) {
            // Get the editor for the opened document
            const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === document.uri.toString());
            await analyzeQuery(document, editor);
        }
    }));

    // Note: Selection change event handler is already registered above, no need to duplicate it
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Dispose of UI components
    disposeStatusBar();

    // Clear any pending timers
    if (changeDebounceTimer) {
        clearTimeout(changeDebounceTimer);
    }

    // Clear all timeouts in savingDocuments Map
    savingDocuments.forEach((timer) => {
        clearTimeout(timer);
    });

    // Clean up resources from different services
    cleanupSelectionResources();
    resetAnalysisState();
    resetDryRunTracking();

    // Clear collection data
    clearDocumentVersionCache();
    closingDocuments.clear();
    savingDocuments.clear();
    
    console.log('BigQuery Previewer extension deactivated, all resources cleared.');
}
