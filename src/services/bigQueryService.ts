import { BigQuery } from '@google-cloud/bigquery';
import { getConfiguration } from './configurationService';

// Dry run tracking
let dryRunCount: number = 0;
let lastDryRunTime: number | null = null;
let isDryRunTrackingEnabled: boolean = false;

/**
 * Result of a BigQuery dry run operation
 */
export interface DryRunResult {
    scannedBytes: number;
    errors: string[];
}

/**
 * Updates the tracking setting from configuration
 */
export function updateTrackingSettings(): void {
    const config = getConfiguration();
    isDryRunTrackingEnabled = config.trackDryRuns;
}

/**
 * Initialize a BigQuery client based on the current configuration
 * @returns Promise with a configured BigQuery client
 */
export async function initializeBigQueryClient(): Promise<BigQuery> {
    const config = getConfiguration();

    if (config.authMode === 'service_account' && config.serviceAccountKeyPath) {
        return new BigQuery({
            keyFilename: config.serviceAccountKeyPath
        });
    }

    // Default to ADC if no service account is configured
    return new BigQuery();
}

/**
 * Perform a dry run of a BigQuery query
 * @param query The SQL query to analyze
 * @returns Promise with scan size and any errors
 */
export async function performDryRun(query: string): Promise<DryRunResult> {
    const bigquery = await initializeBigQueryClient();
    const currentTime = Date.now();
    
    // Track dry run statistics if enabled
    if (isDryRunTrackingEnabled) {
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

/**
 * Get the current dry run statistics
 * @returns Object with dry run count, timing information, and timestamps
 */
export function getDryRunStats(): {
    count: number;
    lastRunTime: number | null;
    timeSinceLast: string;
    currentTime: number;
} {
    const currentTime = Date.now();
    let timeDiff = 'N/A';
    
    if (lastDryRunTime !== null) {
        const diffMs = currentTime - lastDryRunTime;
        timeDiff = `${(diffMs / 1000).toFixed(2)}s`;
    }
    
    return {
        count: dryRunCount,
        lastRunTime: lastDryRunTime,
        timeSinceLast: timeDiff,
        currentTime: currentTime // Return current timestamp for consistent time displays
    };
}

/**
 * Reset the dry run tracking counters and timer
 */
export function resetDryRunTracking(): void {
    dryRunCount = 0;
    lastDryRunTime = null;
}