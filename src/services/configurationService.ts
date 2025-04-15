import * as vscode from 'vscode';

/**
 * Configuration interface for BigQuery Previewer settings
 */
export interface BigQueryPreviewerConfig {
    authMode: string;
    serviceAccountKeyPath: string;
    scanWarningThresholdMB: number;
    autoRunOnSave: boolean;
    autoRunOnChange: boolean;
    autoRunOnOpen: boolean;
    enableStatusBar: boolean;
    enableNotifications: boolean;
    showScanWarnings: boolean;
    changeDebounceDelayMs: number;
    trackDryRuns: boolean;
}

/**
 * Gets all configuration settings for the extension
 * @returns Configuration object with all BigQuery Previewer settings
 */
export function getConfiguration(): BigQueryPreviewerConfig {
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