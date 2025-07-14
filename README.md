# Claude Code Usage Tracker - VSCode Extension

A comprehensive VSCode extension that provides real-time tracking and analytics for Claude Code token usage and costs, bringing ccusage functionality directly into your development environment.

## Features

### 📊 **Real-time Usage Tracking**
- Live monitoring of Claude Code conversations
- Automatic detection of transcript files in `~/.claude/projects/`
- Real-time token counting and cost calculation
- Status bar integration showing current usage stats

### 📈 **Comprehensive Analytics**
- **Dashboard View**: Overview of total usage, costs, and recent sessions
- **Daily Reports**: Detailed breakdown of usage by day
- **Monthly Reports**: Monthly aggregated statistics with daily breakdown
- **Live Session Monitor**: Real-time tracking of active conversations

### 💰 **Cost Tracking**
- Accurate cost calculations for all Claude models (Opus, Sonnet, Haiku)
- Separate tracking for input, output, cache creation, and cache read tokens
- Real-time cost monitoring with automatic pricing updates

### 🔍 **Session Analysis**
- Individual conversation tracking
- Project-based organization
- Turn-by-turn usage breakdown
- Duration and activity analysis

### ⚡ **Performance Features**
- Efficient file watching with automatic deduplication
- Low resource usage with background processing
- Fast parsing of large JSONL files
- Configurable refresh intervals

## Installation

### From Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to run the extension in a new Extension Development Host window

### Packaging
```bash
npm install -g @vscode/vsce
vsce package
```

## Configuration

The extension automatically detects Claude projects directories, but you can configure:

### Settings

#### Path Detection Settings
- **`ccusage.claudeProjectsPath`**: Custom path to Claude projects directory
- **`ccusage.executionHost`**: Execution environment (`auto`, `local`, `wsl`, `container`)
- **`ccusage.quickMode`**: Enable quick mode - only check common Claude paths (default: true)
- **`ccusage.enableWSLDetection`**: Enable WSL path detection from Windows (default: false)
- **`ccusage.stopOnFirstValidPath`**: Stop searching after finding the first valid Claude path (default: true)
- **`ccusage.verboseLogging`**: Enable verbose logging for debugging path detection (default: false)

#### WSL-Specific Settings
- **`ccusage.wslDistribution`**: WSL distribution name (default: "Ubuntu")
- **`ccusage.wslWindowsUsername`**: Windows username for WSL environment (auto-detected if empty)
- **`ccusage.wslClaudePath`**: Manual WSL Claude path (e.g., `\\\\wsl$\\Ubuntu\\root\\.claude\\projects`)

#### Other Settings
- **`ccusage.containerWorkspaceFolder`**: Workspace folder path in container
- **`ccusage.refreshInterval`**: Refresh interval for live monitoring (default: 5000ms)
- **`ccusage.showStatusBar`**: Show/hide usage stats in status bar (default: true)

### Auto-detection

The extension uses an optimized path detection system:

#### Quick Mode (Default)
When `quickMode` is enabled (default), the extension only checks the most common paths:
- `~/.claude/projects/`
- `~/.config/claude/projects/`
- `%APPDATA%\Roaming\Claude\` (Windows)

#### Full Search Mode
When `quickMode` is disabled, additional paths are checked:
- All Windows AppData variations
- WSL paths (if `enableWSLDetection` is true)
- Multiple user directories

#### Performance Optimization
- **Stop on First**: By default, stops searching after finding the first valid path
- **WSL Detection**: Disabled by default to improve performance on Windows
- **Verbose Logging**: Disabled by default to reduce console output
- `/mnt/c/Users/{username}/AppData/Roaming/claude/projects/`
- `/mnt/c/Users/{username}/AppData/Local/claude/projects/`
- `~/.claude/projects/` (Linux home)
- `~/.config/claude/projects/` (Linux home)

**Remote Container:**
- `/workspace/.claude/projects/`
- `/app/.claude/projects/`
- `/home/vscode/.claude/projects/`
- `{workspaceFolder}/.claude/projects/`

## Usage

### Commands

Access these commands via the Command Palette (`Ctrl+Shift+P`):

- **`Claude Usage: Show Usage Dashboard`**: Open the main analytics dashboard
- **`Claude Usage: Daily Report`**: Generate a daily usage report
- **`Claude Usage: Monthly Report`**: Generate a monthly usage report  
- **`Claude Usage: Live Session Monitor`**: View active sessions in real-time

### Status Bar

The status bar shows quick stats: `🔄 1,234 tokens ($0.05)`
- Click to open the main dashboard
- Configure visibility in settings

### Dashboard Features

#### Main Dashboard
- Total tokens, costs, and session counts
- Model-specific breakdowns
- Recent sessions table
- Cost projections and trends

#### Daily/Monthly Reports
- Detailed usage statistics
- Session breakdowns
- Cost analysis
- Historical comparisons

#### Live Session Monitor
- Real-time active session tracking
- Auto-refresh every 5 seconds
- Current token burn rates
- Active project monitoring

## Data Sources

The extension monitors JSONL transcript files from Claude Code, processing:
- Conversation metadata
- Token usage statistics
- Model information
- Timestamp and project data
- Cost calculation data

## Architecture

### Core Components

- **JSONLParser**: Efficient JSONL file parsing with deduplication
- **AnalyticsEngine**: Token counting, cost calculation, and report generation
- **FileWatcher**: Real-time file system monitoring using chokidar
- **WebViewProvider**: Dashboard and report visualization
- **Extension**: Main VSCode integration and command handling

### Data Flow

1. **File Monitoring**: Watch `~/.claude/projects/` for new/changed JSONL files
2. **Parsing**: Extract conversation entries with global deduplication
3. **Analytics**: Calculate usage statistics and costs
4. **Visualization**: Display data in WebView dashboards
5. **Real-time Updates**: Automatically refresh as new data arrives

## Troubleshooting

### WSL Environment Issues

If Claude Code data is not detected in WSL:

1. **Check Environment Detection**
   - Use `Claude Usage: Show Environment Status` command
   - Verify it detects WSL environment correctly

2. **Manual Configuration**
   - Set `ccusage.wslWindowsUsername` to your Windows username
   - Example: `"ccusage.wslWindowsUsername": "YourUsername"`

3. **Verify Windows User Directory Access**
   - Check if `/mnt/c/Users/{YourUsername}` is accessible
   - Ensure Windows filesystem is mounted properly

4. **Custom Path Configuration**
   - Set `ccusage.claudeProjectsPath` to exact path
   - Example: `"/mnt/c/Users/YourName/.claude/projects"`

### Remote Container Issues

If data is not found in containers:

1. **Mount Claude Data Directory**
   - Add volume mount in `devcontainer.json`:
   ```json
   "mounts": [
     "source=${localEnv:HOME}/.claude,target=/workspace/.claude,type=bind"
   ]
   ```

2. **Configure Workspace Folder**
   - Set `ccusage.containerWorkspaceFolder` setting
   - Point to mounted Claude data location

### General Issues

- Use `Claude Usage: Show Environment Status` for diagnostic information
- Check VSCode Developer Console for error messages
- Verify Claude Code is generating transcript files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Changelog

### 0.0.1
- Initial release
- Basic usage tracking and analytics
- Dashboard and report views
- File system monitoring
- Status bar integration