# BigQuery Previewer

BigQuery Previewer is a Visual Studio Code extension that helps developers analyze BigQuery SQL files before execution. It performs a **dry run** of the query using the BigQuery API to detect potential issues such as high data scan volume and query errors — without actually executing the query. This tool enables safer and more cost-aware SQL development directly from within VS Code.

## Features

- **Dry Run Execution**: Analyze BigQuery SQL files without executing them.
- **Scan Estimation**: Fetch and display the total estimated bytes scanned by the query.
- **Error Detection**: Identify syntax or semantic errors in queries.
- **Triggering Mechanisms**: Analyze queries manually, via keyboard shortcuts, or automatically on file save.
- **Status Bar Feedback**: View scan results and errors in the VS Code status bar.
- **Configurable Options**: Customize thresholds, notifications, and authentication methods.

## Requirements

- Google Cloud SDK installed and authenticated (`gcloud auth application-default login`) or a service account JSON key file.
- Node.js and npm installed for development.

## Usage

1. Open a `.sql` file in VS Code.
2. Run the command `BigQuery Previewer: Analyze Query` from the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`).
3. View the results in the status bar or as notifications.

## Extension Settings

This extension contributes the following settings:

```json
{
    "bigqueryPreviewer.authMode": "adc", // or "service_account"
    "bigqueryPreviewer.serviceAccountKeyPath": "/path/to/key.json",
    "bigqueryPreviewer.showScanWarnings": true,
    "bigqueryPreviewer.scanWarningThresholdMB": 100,
    "bigqueryPreviewer.autoRunOnSave": true,
    "bigqueryPreviewer.enableStatusBar": true,
    "bigqueryPreviewer.enableNotifications": false
}
```

## Known Issues

- Ensure the Google Cloud SDK is properly configured for ADC authentication.
- Service account key files must be accessible and correctly specified in settings.

## Release Notes

### 0.0.1

- Initial release with dry run, scan estimation, and error detection features.
