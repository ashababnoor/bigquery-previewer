/**
 * Utility functions for formatting data
 */

/**
 * Formats data size in bytes to a human-readable string (KB, MB, GB, TB)
 * @param bytes The size in bytes to format
 * @returns A formatted string with appropriate unit (KB, MB, GB, TB)
 */
export function formatDataSize(bytes: number): string {
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