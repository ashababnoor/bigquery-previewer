# Changelog

All notable changes to the "BigQuery Previewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Selection Analysis: When text is selected in a SQL file, only the selected portion will be analyzed instead of the entire file
- Visual indication in status bar when analyzing a selection vs. the entire file
- Hover support for error messages: Full error details now appear when hovering over the status bar
- "View Full Error" option when clicking on error messages in status bar
- Automatic data size formatting: Scan sizes now show as KB, MB, GB, or TB as appropriate
- Auto-analysis on text selection: SQL queries are automatically analyzed when text is selected (with rate limiting)
- Delayed selection analysis: Waits for selections to stabilize before analysis and cancels if selection is removed
- Custom wait time parameter for analysis function, allowing flexible rate limiting for different analysis triggers
- Dry Run Tracking: New option to track the number and timing of dry run operations
  - Track total count of dry runs performed during the session
  - View statistics in the output panel when enabled
- Toggle for enabling/disabling dry run tracking via settings (`bigqueryPreviewer.trackDryRuns`)

### Changed
- Improved performance: Skip analysis when closing files, even if they're being saved during closure
- Changed notification dialogs to show an "X" close button instead of "Cancel"
- Improved code organization with centralized SQL file detection logic
- Enhanced `analyzeQuery` function to accept an optional wait time parameter, providing more flexible control over analysis timing

## [1.0.0] - 2025-04-12

### Added
- Initial release of BigQuery Previewer extension
- Dry run execution of BigQuery SQL queries without actually running them
- Scan estimation showing the total bytes scanned by a query 
- Error detection for SQL syntax and semantic errors
- Status bar integration with color-coded feedback:
  - Green (with checkmark icon) for successful scans
  - Yellow (with warning icon) for scans exceeding the configured threshold
  - Red for query errors
- Interactive status bar controls:
  - Control button to start/pause the extension
  - Result display for scan information
  - Context-aware menu options when clicking on results
- Multiple triggering mechanisms:
  - Manual analysis via Command Palette
  - Automatic analysis on file save (configurable)
  - Automatic analysis on file change with debounce (configurable)
  - Automatic analysis on file open (configurable)
- Intelligent analysis to avoid redundant API calls
- Auto-dismissing notifications (3-second timeout)
- Extension starts in paused state by default to avoid excessive API calls
- Comprehensive settings for customization:
  - Authentication modes (ADC and service account)
  - Warning thresholds
  - Automatic analysis options
  - Debounce delay configuration
  - UI feedback preferences

[1.0.0]: https://github.com/ashababnoor/bigquery-previewer/releases/tag/v1.0.0
[Unreleased]: https://github.com/ashababnoor/bigquery-previewer/compare/v1.0.0...HEAD