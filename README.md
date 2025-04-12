# BigQuery Previewer

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/ashababnoor/bigquery-previewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

BigQuery Previewer is a Visual Studio Code extension that helps developers analyze BigQuery SQL files before execution. It performs a **dry run** of the query using the BigQuery API to detect potential issues such as high data scan volume and query errors — without actually executing the query. This tool enables safer and more cost-aware SQL development directly from within VS Code.

## Features

- **Dry Run Execution**: Analyze BigQuery SQL files without executing them.
- **Scan Estimation**: Fetch and display the total estimated bytes scanned by the query.
- **Error Detection**: Identify syntax or semantic errors in queries.
- **Interactive UI Controls**:
  - Start/pause analysis via status bar button or command palette
  - Interactive result display with options to pause or hide results
- **Multiple Triggering Mechanisms**:
  - Analyze queries manually via Command Palette
  - Set custom keyboard shortcuts for quick analysis
  - Automatically analyze on file save
  - Automatically analyze on file content changes (with configurable debounce delay)
  - Automatically analyze when opening SQL files
- **Intelligent Analysis**: Avoids redundant analysis of unchanged content within a specified time window.
- **Status Bar Integration**: Real-time feedback with color coding (green for success, yellow for warnings, red for errors).
- **Configurable Settings**: Customize thresholds, toggle features, and control automatic analysis behavior.

## Requirements

- Google Cloud SDK installed and authenticated (`gcloud auth application-default login`) or a service account JSON key file.
- VS Code version 1.99.0 or higher.
- Node.js and npm (for development only).

## Installation

### From VS Code Marketplace
The easiest way to install BigQuery Previewer:
1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS)
3. Search for `shabab.bigquery-previewer`
4. Click Install

You can also install directly from the command line:
```
code --install-extension shabab.bigquery-previewer
```

### From VSIX File
1. Download the `.vsix` file from the repository releases.
2. In VS Code, go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS). Click on the "..." menu at the top-right of the Extensions panel and select "Install from VSIX...".
3. **OR**, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and type `Extensions: Install from VSIX...`.
4. Select the downloaded `.vsix` file and install.

### Manual Build
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run package` to build the extension.
4. The `.vsix` file will be generated in the project root.

## Usage

### Basic Usage
1. Open a `.sql` file in VS Code.
2. Click the "$(debug-start) BigQuery Previewer" button in the status bar or run the command "BigQuery Previewer: Start" from the Command Palette to activate the extension.
3. The extension will then analyze your SQL files according to your configuration settings.
4. View the results in the status bar (scan size, warnings, or errors).
5. Click on the result in the status bar to access options to pause the extension or hide the result.

### Starting and Pausing the Extension
- The extension starts in a paused state to avoid unnecessary API calls.
- To start analysis: Click the "$(debug-start) BigQuery Previewer" button in the status bar or run the "BigQuery Previewer: Start" command.
- To pause analysis: Click the "$(debug-pause) BigQuery Previewer" button or run the "BigQuery Previewer: Pause" command.
- When paused, no automatic analysis will run, saving API calls and resources.

### Interactive Status Bar
- **Control Button**: Shows the current state of the extension (active or paused) and allows toggling between states.
- **Result Display**: Shows analysis results with color coding and intuitive icons
- **Result Options**: Click on any result to access a context-aware menu with relevant options:
  - When active: Option to pause the extension
  - When paused: Option to start the extension
  - Option to hide the current result (only shown when results are visible)

### Manual Analysis
- Run the command `BigQuery Previewer: Analyze Query` from the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`).
- If the extension is paused, you'll be prompted to activate it first.
- Customize a keyboard shortcut for frequent use.

### Automatic Analysis
When the extension is active, it analyzes SQL files:
- When opening a SQL file (if `autoRunOnOpen` is enabled)
- When saving a SQL file (if `autoRunOnSave` is enabled)
- When making changes to a SQL file (if `autoRunOnChange` is enabled)

These automatic behaviors can be enabled or disabled in settings.

## Extension Settings

This extension contributes the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `bigqueryPreviewer.authMode` | Authentication mode for BigQuery (`"adc"` or `"service_account"`) | `"adc"` |
| `bigqueryPreviewer.serviceAccountKeyPath` | Path to service account key file | `""` |
| `bigqueryPreviewer.showScanWarnings` | Enable or disable scan warnings | `true` |
| `bigqueryPreviewer.scanWarningThresholdMB` | Threshold for scan size warnings (MB) | `100` |
| `bigqueryPreviewer.autoRunOnSave` | Automatically analyze on file save | `true` |
| `bigqueryPreviewer.autoRunOnChange` | Automatically analyze on file content change | `true` |
| `bigqueryPreviewer.changeDebounceDelayMs` | Delay in milliseconds to wait after typing stops before analyzing (when autoRunOnChange is enabled) | `1500` |
| `bigqueryPreviewer.autoRunOnOpen` | Automatically analyze when opening a file | `true` |
| `bigqueryPreviewer.enableStatusBar` | Enable or disable status bar feedback | `true` |
| `bigqueryPreviewer.enableNotifications` | Enable or disable popup notifications | `false` |

## Authentication

### Application Default Credentials (ADC)
Use the Google Cloud SDK to authenticate:
```bash
gcloud auth application-default login
```

### Service Account
1. Create a service account with appropriate BigQuery permissions
2. Generate and download a JSON key file
3. Set the path to the key file in the extension settings

## Known Issues

- Ensure the Google Cloud SDK is properly configured for ADC authentication.
- Service account key files must be accessible and correctly specified in settings.
- VS Code must have permission to access the key file location.

## Release Notes

Check out the [CHANGELOG](CHANGELOG.md) for detailed release notes.

### 1.0.0 - April 2025

- Initial release with dry run, scan estimation, and error detection features
- Automatic analysis on file save, file changes, and file open
- Status bar integration with color-coded feedback
- Configurable settings for thresholds and behavior

## Development

- Extension built with TypeScript and VS Code Extension API
- Uses Google Cloud BigQuery SDK for dry run analysis
- Comprehensive test suite using Mocha and Sinon
