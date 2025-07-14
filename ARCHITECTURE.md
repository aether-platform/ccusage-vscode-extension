# Architecture Notes

## Submodule-based Reference Architecture

This project uses Git submodules to reference external code repositories as a source of truth for implementation patterns and features.

### Current Submodules

1. **ccusage** (`refs/ccusage/`)
   - **Repository**: ryoppippi/ccusage
   - **Purpose**: Reference implementation for Claude Code usage analysis
   - **Key Features**:
     - JSONL parsing with deduplication
     - Token counting and cost calculation
     - Multiple output formats (table, JSON)
     - MCP server integration
     - Support for multiple Claude data directories
     - 5-hour billing block analysis
     - Session-based usage tracking

2. **ccusage-vscode-extension** (`refs/ccusage-vscode-extension/`)
   - **Repository**: aether-platform/ccusage-vscode-extension
   - **Purpose**: Reference for VS Code extension implementation
   - **Key Features**:
     - Status bar integration
     - Real-time usage monitoring
     - Webview dashboards
     - Command palette integration

### Use Case: Feature Updates
- **Purpose**: To incorporate the latest features from reference implementations
- **Pattern**: Use submodules to track upstream repositories containing reference implementations
- **Benefit**: Allows selective adoption of new features while maintaining project-specific customizations

### Key Patterns from Reference Code

#### Data Processing (from ccusage)
- **JSONL Parsing**: Handle malformed lines gracefully with try-catch
- **Deduplication**: Use message ID + request ID hash for unique entries
- **Cost Calculation**: Support both pre-calculated costs and dynamic calculation
- **Model Normalization**: Map various model name formats to canonical names

#### Architecture Patterns (from ccusage)
- **Separation of Concerns**: Clear data flow from loader → aggregation → presentation
- **Type Safety**: Use branded types (e.g., `createModelName()`) for domain objects
- **Error Handling**: Prefer `@praha/byethrow` Result type over try-catch
- **Testing**: In-source testing with `import.meta.vitest`

#### VS Code Extension Patterns
- **Status Bar**: Real-time cost display with auto-refresh
- **Webviews**: HTML-based dashboards for detailed analytics
- **File Watching**: Monitor Claude data directories for changes
- **Multi-platform**: Handle Windows/WSL path differences

### Update Strategy

1. **Feature Discovery**
   ```bash
   # Check for updates in reference repos
   cd refs/ccusage && git fetch && git log HEAD..origin/main --oneline
   cd ../ccusage-vscode-extension && git fetch && git log HEAD..origin/main --oneline
   ```

2. **Selective Adoption**
   - Review new features in reference implementations
   - Adapt patterns to match project requirements
   - Maintain compatibility with existing code

3. **Sync Points**
   - Model pricing updates from ccusage
   - JSONL format changes
   - New analytics features
   - UI/UX improvements

### Implementation Notes
- Submodules enable version-controlled references to external repositories
- Updates can be pulled selectively to incorporate new features
- Maintains separation between reference code and project-specific implementations
- Reference implementations serve as documentation and test cases

### Technical Debt Tracking
- **Parser Alignment**: Current parser should match ccusage's deduplication logic
- **Cost Modes**: Implement ccusage's auto/calculate/display modes
- **Token Utilities**: Consider adopting ccusage's token aggregation utilities
- **MCP Integration**: Evaluate ccusage's MCP server implementation

### Future Considerations
- When updating features, check submodule repositories for latest implementations
- Consider compatibility when pulling updates from reference repositories
- Document any divergences from reference implementations
- Monitor for breaking changes in Claude Code JSONL format
- Track LiteLLM model pricing updates

---
*Note: This document records architectural decisions for future reference.*