import * as vscode from 'vscode';

// Track document versions to detect changes
const documentVersions = new Map<string, number>();

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
export function isEligibleForAnalysis(document: vscode.TextDocument): boolean {
    return document.languageId === 'sql' || document.fileName.endsWith('.sql');
}

/**
 * Compares two selections for equality
 * @param a First selection
 * @param b Second selection
 * @returns true if selections are equal, false otherwise
 */
export function areSelectionsEqual(a: vscode.Selection, b: vscode.Selection): boolean {
    return (
        a.anchor.line === b.anchor.line &&
        a.anchor.character === b.anchor.character &&
        a.active.line === b.active.line &&
        a.active.character === b.active.character
    );
}

/**
 * Removes a document from the version tracking cache when it's closed
 * @param uri The URI of the document to remove
 */
export function removeDocumentFromCache(uri: string): void {
    documentVersions.delete(uri);
}

/**
 * Clears the document version cache
 * Used during extension deactivation
 */
export function clearDocumentVersionCache(): void {
    documentVersions.clear();
}