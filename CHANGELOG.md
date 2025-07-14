# Changelog

All notable changes to the Claude Usage Tracker extension will be documented in this file.

## [0.0.2] - 2025-01-13

### Added
- **Quick Mode**: New default mode that only checks common Claude paths for better performance
- **Performance Settings**: 
  - `ccusage.quickMode`: Enable/disable quick path detection (default: true)
  - `ccusage.enableWSLDetection`: Control WSL path detection from Windows (default: false)
  - `ccusage.stopOnFirstValidPath`: Stop searching after finding first valid path (default: true)
  - `ccusage.verboseLogging`: Control logging verbosity (default: false)

### Changed
- Optimized path detection to reduce unnecessary filesystem checks
- WSL detection is now disabled by default on Windows for better performance
- Reduced verbose logging output by default
- Improved path checking order - most common paths are checked first
- Status display now shows current configuration settings

### Fixed
- Excessive path searching on Windows systems
- Unnecessary WSL distribution enumeration
- Verbose logging cluttering the console

## [0.0.1] - 2025-01-12

### Initial Release
- Real-time Claude usage tracking
- Token counting and cost calculation
- Multiple dashboard views (main, daily, monthly, live)
- Status bar integration
- Multi-environment support (Local, WSL, Container)
- File watching for real-time updates
- Comprehensive analytics and reporting