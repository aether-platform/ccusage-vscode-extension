# Architecture Notes

## Submodule-based Reference Architecture

This project uses Git submodules to reference external code repositories as a source of truth for implementation patterns and features.

### Use Case: Feature Updates
- **Purpose**: To incorporate the latest features from reference implementations
- **Pattern**: Use submodules to track upstream repositories containing reference implementations
- **Benefit**: Allows selective adoption of new features while maintaining project-specific customizations

### Implementation Notes
- Submodules enable version-controlled references to external repositories
- Updates can be pulled selectively to incorporate new features
- Maintains separation between reference code and project-specific implementations

### Future Considerations
- When updating features, check submodule repositories for latest implementations
- Consider compatibility when pulling updates from reference repositories
- Document any divergences from reference implementations

---
*Note: This document records architectural decisions for future reference.*