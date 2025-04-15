# Changelog

All notable changes to the "BigQuery Previewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-04-15

### Changed
- Reduced minimum VS Code version requirement from 1.99.0 to 1.74.0 for better compatibility with older VS Code installations

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

[1.0.1]: https://github.com/ashababnoor/bigquery-previewer/releases/tag/v1.0.1
[1.0.0]: https://github.com/ashababnoor/bigquery-previewer/releases/tag/v1.0.0