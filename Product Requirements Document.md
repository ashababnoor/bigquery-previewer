# BigQuery Previewer – Project Requirements Document

## 1. Overview

BigQuery Previewer is a Visual Studio Code extension that helps developers analyze BigQuery SQL files before execution. It performs a **dry run** of the query using the BigQuery API to detect potential issues such as high data scan volume and query errors — without actually executing the query. This tool enables safer and more cost-aware SQL development directly from within VS Code.

---

## 2. Functional Requirements

### 2.1 File Detection  
**R1.** The extension must detect if the currently open file is a `.sql` file before attempting analysis.

### 2.2 Dry Run Execution  
**R2.** The extension must perform a BigQuery dry run using the Google Cloud SDK or service account authentication.  
**R3.** The extension must not execute the query (only dry-run).

### 2.3 Scan Estimation  
**R4.** The extension must fetch and display the total estimated bytes scanned by the query.  
**R5.** If the scan size exceeds a configurable threshold (in MB), a warning must be issued.  
  **R5.1.** The extension must allow users to enable or disable scan warnings via the `bigqueryPreviewer.showScanWarnings` setting. If disabled, only the scan size and errors are displayed.

### 2.4 Error Detection  
**R6.** The extension must show syntax or semantic errors detected during the dry run process.

### 2.5 Triggering Mechanism  
**R7.** The extension must support running the analysis manually via Command Palette (e.g., `BigQuery Previewer: Analyze Query`).  
**R8.** The extension must allow defining a custom keyboard shortcut (keybinding) for quick analysis.  
**R9.** The extension must support automatic analysis on certain conditions.  
  **R9.1.** Automatic analysis on file save (if enabled in settings).  
  **R9.2.** Automatic analysis on file change (if enabled in settings).  
    **R9.2.1.** When analyzing on file change, the extension must implement a configurable debounce mechanism to prevent excessive API calls during typing.  
  **R9.3.** Automatic analysis on file open (if enabled in settings).  
  **R9.4.** Automatic analysis on text selection after a stabilization delay (750ms; configurable).
    **R9.4.1.** The extension must only analyze a selection after it remains unchanged for the stabilization period.
    **R9.4.2.** The extension must cancel pending selection analysis if the selection changes before the delay elapses.
    **R9.4.3.** The extension must limit the number of selection-triggered analyses to prevent excessive API calls.
    **R9.4.4.** Selection-based analysis results must be visually distinct in the status bar (with a selection icon).
  **R9.5.** The extension must support different wait time intervals between analyses for different trigger types.
    **R9.5.1.** The analysis function must support a configurable override for the default wait time.
    **R9.5.2.** The extension must allow for customized wait times based on the type of trigger (manual, save, change, open, selection).
**R10.** The extension must provide a way to cancel an ongoing analysis if needed.  
**R11.** The extension must start in a paused state, requiring explicit activation before performing any analysis.  
  **R11.1.** The extension must display a status bar button to start/pause the extension.  
  **R11.2.** Commands must be available in the Command Palette to start and pause the extension.  
  **R11.3.** Notifications for starting and pausing should automatically dismiss after a short period (3 seconds).  
**R12.** The result status bar item must be interactive.  
  **R12.1.** Clicking on the result should show a context-aware menu with relevant options:  
    **R12.1.1** When the extension is active, show an option to pause it.  
    **R12.1.2** When the extension is paused, show an option to start it.  
    **R12.1.3** Show an option to hide the result only when results are visible.

### 2.6 Performance Monitoring
**R13.** The extension must support tracking of dry run operations.  
  **R13.1.** The extension must track the number of dry run operations performed.  
  **R13.2.** The extension must track the timing of dry run operations.  
  **R13.3.** The tracking feature must be configurable through the `bigqueryPreviewer.trackDryRuns` setting.

## 3. Non-Functional Requirements

**R14.** The extension should return feedback in under 1 second for typical queries.  
**R15.** No sensitive query data should be stored or executed during the dry run process.  
**R16.** The extension must support Windows, macOS, and Linux environments.  
**R17.** Users must be able to configure thresholds and toggle features such as warnings and notifications.  
**R18.** The extension must be installable locally via a `.vsix` file without requiring it to be published on the marketplace.  
**R19.** The extension should support mocking dry run behavior to allow for unit and integration testing.  

---

## 4. User Interface Requirements

### 4.1 Status Bar Feedback  
**R20.** The extension must show scan results (e.g., bytes to be scanned, error state) in the VS Code status bar by default.  
  **R20.1.** If the status bar is enabled, the extension must indicate in the status bar when the analysis starts (e.g. `"Analyzing..."`), and update it with the result (success, warning, or error) when done instead of creating popups (info message). If the status bar is disabled, the extension must fall back to using popups.  
**R21.** The status bar output must be clear and human-readable, displaying the scan size in MB or GB.  
**R22.** The status bar output must be color coded to indicate the state (e.g., green for safe, yellow for warning, red for error).  

### 4.2 Notifications  
**R23.** The extension must support (optional) popup notifications to display scan warnings or error messages. This behavior should be configurable.

---

## 5. Authentication

**R24.** The extension must support authentication via Application Default Credentials (ADC) using `gcloud auth application-default login`.  
**R25.** The extension must support service account authentication via a JSON key file path provided in settings.  
**R26.** The extension must allow users to toggle between authentication methods in settings.  
**R27.** The extension must provide clear documentation on how to set up each authentication method.

---

## 6. Configuration Options

**R28.** The extension must expose the following configurable options via `settings.json`:

```json
{
  "bigqueryPreviewer.authMode": "adc", // or "service_account"
  "bigqueryPreviewer.serviceAccountKeyPath": "/path/to/key.json",
  "bigqueryPreviewer.showScanWarnings": true,
  "bigqueryPreviewer.scanWarningThresholdMB": 100,
  "bigqueryPreviewer.autoRunOnSave": true,
  "bigqueryPreviewer.autoRunOnChange": true,
  "bigqueryPreviewer.changeDebounceDelayMs": 1500,
  "bigqueryPreviewer.autoRunOnOpen": true,
  "bigqueryPreviewer.enableStatusBar": true,
  "bigqueryPreviewer.enableNotifications": false,
  "bigqueryPreviewer.trackDryRuns": false
}
```