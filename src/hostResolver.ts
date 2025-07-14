import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HostEnvironment {
  type: 'local' | 'wsl' | 'container';
  claudePaths: string[];
  pathResolver: (relativePath: string) => string;
}

export class HostResolver {
  private static config = vscode.workspace.getConfiguration('ccusage');
  private static verboseLogging = HostResolver.config.get<boolean>('verboseLogging', false);
  
  private static log(message: string, force: boolean = false) {
    if (HostResolver.verboseLogging || force) {
      console.log(message);
    }
  }
  
  static async resolveExecutionHost(): Promise<HostEnvironment> {
    // Refresh config
    this.config = vscode.workspace.getConfiguration('ccusage');
    this.verboseLogging = this.config.get<boolean>('verboseLogging', false);
    
    const executionHost = this.config.get<string>('executionHost', 'auto');
    
    this.log(`[HostResolver] executionHost setting: ${executionHost}`);
    
    switch (executionHost) {
      case 'local':
        return this.createLocalEnvironment();
      case 'wsl':
        return this.createWSLEnvironment();
      case 'container':
        return this.createContainerEnvironment();
      case 'auto':
      default:
        return this.autoDetectEnvironment();
    }
  }

  private static autoDetectEnvironment(): HostEnvironment {
    this.log(`[HostResolver] Auto-detecting environment...`);
    
    // Check if running in Remote Container
    if (this.isRemoteContainer()) {
      this.log(`[HostResolver] Detected: Remote Container`, true);
      return this.createContainerEnvironment();
    }
    
    // Check if running in WSL
    if (this.isWSL()) {
      this.log(`[HostResolver] Detected: WSL`, true);
      return this.createWSLEnvironment();
    }
    
    // Default to local
    this.log(`[HostResolver] Detected: Local`, true);
    return this.createLocalEnvironment();
  }

  private static isRemoteContainer(): boolean {
    const remoteEnv = vscode.env.remoteName;
    const devContainer = process.env.DEVCONTAINER;
    const containerEnv = process.env.CONTAINER_ENV;
    
    return !!(remoteEnv === 'dev-container' || devContainer || containerEnv);
  }

  private static isWSL(): boolean {
    const platform = os.platform();
    const release = os.release();
    const wslEnv = process.env.WSL_DISTRO_NAME;
    
    return platform === 'linux' && (
      release.toLowerCase().includes('microsoft') ||
      release.toLowerCase().includes('wsl') ||
      !!wslEnv
    );
  }

  private static createLocalEnvironment(): HostEnvironment {
    const homedir = os.homedir();
    const quickMode = this.config.get<boolean>('quickMode', true);
    const stopOnFirst = this.config.get<boolean>('stopOnFirstValidPath', true);
    const enableWSL = this.config.get<boolean>('enableWSLDetection', false);
    
    this.log(`[HostResolver] Local environment home directory: ${homedir}`);
    this.log(`[HostResolver] Quick mode: ${quickMode}, Stop on first: ${stopOnFirst}, WSL detection: ${enableWSL}`);
    
    const paths: string[] = [];
    const foundPaths: string[] = [];
    
    // Priority 1: Most common Claude paths
    const primaryPaths = [
      path.join(homedir, '.claude', 'projects'),
      path.join(homedir, '.config', 'claude', 'projects')
    ];
    
    if (process.platform === 'win32') {
      // Add the most common Windows paths first
      primaryPaths.push(
        path.join(homedir, 'AppData', 'Roaming', 'Claude', 'projects'),
        path.join(homedir, 'AppData', 'Roaming', 'Claude')
      );
    }
    
    // Check primary paths first
    for (const primaryPath of primaryPaths) {
      if (this.checkAndAddPath(primaryPath, paths, foundPaths)) {
        if (stopOnFirst && foundPaths.length > 0) {
          this.log(`[HostResolver] Found valid path, stopping search (stopOnFirstValidPath=true)`, true);
          break;
        }
      }
    }
    
    // If not in quick mode and haven't found paths yet, check additional locations
    if (!quickMode && (!stopOnFirst || foundPaths.length === 0)) {
      this.log(`[HostResolver] Checking additional paths (quick mode disabled)`);
      
      if (process.platform === 'win32') {
        const additionalPaths = [
          path.join(homedir, 'AppData', 'Local', 'Claude'),
          path.join(homedir, 'AppData', 'Roaming', 'AnthropicClaude'),
          path.join(homedir, 'AppData', 'Local', 'AnthropicClaude'),
          path.join(homedir, 'AppData', 'Roaming', 'claude-code'),
          path.join(homedir, 'AppData', 'Local', 'claude-code')
        ];
        
        for (const addPath of additionalPaths) {
          if (this.checkAndAddPath(addPath, paths, foundPaths)) {
            if (stopOnFirst && foundPaths.length > 0) {
              break;
            }
          }
        }
      }
    }
    
    // Check manual WSL path if configured
    const manualWSLPath = this.config.get<string>('wslClaudePath');
    if (manualWSLPath && manualWSLPath.trim()) {
      this.log(`[HostResolver] Adding manual WSL path: ${manualWSLPath}`, true);
      paths.push(manualWSLPath.trim());
    }
    
    // Only perform WSL detection if explicitly enabled and on Windows
    if (process.platform === 'win32' && enableWSL && (!stopOnFirst || foundPaths.length === 0)) {
      this.log(`[HostResolver] WSL detection enabled, checking WSL paths...`, true);
      this.detectWSLPaths(paths, foundPaths, stopOnFirst);
    }
    
    this.log(`[HostResolver] Found ${foundPaths.length} valid Claude paths`, true);
    
    return {
      type: 'local',
      claudePaths: paths,
      pathResolver: (relativePath: string) => path.resolve(relativePath)
    };
  }

  private static checkAndAddPath(checkPath: string, paths: string[], foundPaths: string[]): boolean {
    this.log(`[HostResolver] Checking path: ${checkPath}`);
    
    if (fs.existsSync(checkPath)) {
      try {
        const stat = fs.statSync(checkPath);
        if (stat.isDirectory()) {
          // Check if it's a projects directory or contains JSONL files
          const contents = fs.readdirSync(checkPath);
          const hasProjects = checkPath.endsWith('projects') || contents.some(f => f.endsWith('.jsonl'));
          
          if (hasProjects) {
            this.log(`[HostResolver] ✅ Found valid Claude path: ${checkPath}`, true);
            paths.push(checkPath);
            foundPaths.push(checkPath);
            
            // If this is a base Claude directory, also check for projects subdirectory
            if (!checkPath.endsWith('projects')) {
              const projectsPath = path.join(checkPath, 'projects');
              if (fs.existsSync(projectsPath)) {
                this.log(`[HostResolver] ✅ Found projects subdirectory: ${projectsPath}`, true);
                paths.push(projectsPath);
                foundPaths.push(projectsPath);
              }
            }
            
            return true;
          }
        }
      } catch (error: any) {
        this.log(`[HostResolver] Error checking path: ${error.message}`);
      }
    }
    
    return false;
  }

  private static detectWSLPaths(paths: string[], foundPaths: string[], stopOnFirst: boolean) {
    try {
      const { execSync } = require('child_process');
      
      // Quick check if WSL is available
      try {
        execSync('wsl --status', { 
          encoding: 'utf8',
          timeout: 1000,
          windowsHide: true,
          stdio: 'pipe'
        });
      } catch {
        this.log(`[HostResolver] WSL not available, skipping WSL detection`);
        return;
      }
      
      // Get default distribution only
      let defaultDistro = '';
      try {
        const result = execSync('wsl -l -v', { 
          encoding: 'utf8',
          timeout: 2000,
          windowsHide: true
        });
        
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.includes('*')) {
            const match = line.match(/\*?\s*([^\s]+)/);
            if (match && match[1]) {
              defaultDistro = match[1].replace(/\0/g, '').trim();
              break;
            }
          }
        }
      } catch {
        defaultDistro = 'Ubuntu'; // Fallback
      }
      
      if (!defaultDistro) return;
      
      this.log(`[HostResolver] Checking default WSL distribution: ${defaultDistro}`);
      
      // Try the most common WSL paths
      const wslPaths = [
        `\\\\wsl$\\${defaultDistro}\\root\\.claude\\projects`,
        `\\\\wsl.localhost\\${defaultDistro}\\root\\.claude\\projects`
      ];
      
      for (const wslPath of wslPaths) {
        if (this.checkAndAddPath(wslPath, paths, foundPaths)) {
          if (stopOnFirst && foundPaths.length > 0) {
            break;
          }
        }
      }
      
    } catch (error) {
      this.log(`[HostResolver] WSL detection error: ${error}`);
    }
  }

  private static createWSLEnvironment(): HostEnvironment {
    const quickMode = this.config.get<boolean>('quickMode', true);
    const stopOnFirst = this.config.get<boolean>('stopOnFirstValidPath', true);
    
    let wslDistro = this.config.get<string>('wslDistribution', '');
    if (!wslDistro) {
      wslDistro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
    }
    
    this.log(`[HostResolver] Creating WSL environment for distro: ${wslDistro}`, true);
    
    const paths: string[] = [];
    const foundPaths: string[] = [];
    
    // Priority 1: Check Linux home directory in WSL first
    const linuxHome = os.homedir();
    const linuxPaths = [
      path.join(linuxHome, '.claude', 'projects'),
      path.join(linuxHome, '.config', 'claude', 'projects')
    ];
    
    for (const linuxPath of linuxPaths) {
      if (this.checkAndAddPath(linuxPath, paths, foundPaths)) {
        if (stopOnFirst && foundPaths.length > 0) {
          this.log(`[HostResolver] Found valid path, stopping search`, true);
          break;
        }
      }
    }
    
    // Priority 2: Check Windows paths from WSL (only if not in quick mode or no paths found)
    if (!quickMode && (!stopOnFirst || foundPaths.length === 0)) {
      try {
        const windowsUserDir = '/mnt/c/Users';
        if (fs.existsSync(windowsUserDir)) {
          // Try to detect current Windows user
          const manualUsername = this.config.get<string>('wslWindowsUsername');
          const usernames = manualUsername ? [manualUsername] : this.detectWindowsUsernameSimple();
          
          for (const username of usernames) {
            const userPath = path.join(windowsUserDir, username);
            const candidatePaths = [
              path.join(userPath, '.claude', 'projects'),
              path.join(userPath, 'AppData', 'Roaming', 'Claude', 'projects'),
              path.join(userPath, 'AppData', 'Roaming', 'Claude')
            ];
            
            for (const candidatePath of candidatePaths) {
              if (this.checkAndAddPath(candidatePath, paths, foundPaths)) {
                if (stopOnFirst && foundPaths.length > 0) {
                  return {
                    type: 'wsl',
                    claudePaths: paths,
                    pathResolver: (relativePath: string) => path.resolve(relativePath)
                  };
                }
              }
            }
          }
        }
      } catch (error) {
        this.log(`[HostResolver] Error accessing Windows directories: ${error}`);
      }
    }
    
    return {
      type: 'wsl',
      claudePaths: paths,
      pathResolver: (relativePath: string) => path.resolve(relativePath)
    };
  }

  private static detectWindowsUsernameSimple(): string[] {
    const usernames: string[] = [];
    
    try {
      const child_process = require('child_process');
      
      // Try to get Windows username
      try {
        const result = child_process.execSync('cmd.exe /c echo %USERNAME% 2>/dev/null', { 
          encoding: 'utf8', 
          timeout: 2000 
        });
        const username = result.trim();
        if (username && username !== '%USERNAME%') {
          usernames.push(username);
        }
      } catch {
        // Ignore
      }
      
      // If that fails, just return empty array - user can configure manually
    } catch {
      // Ignore
    }
    
    return usernames;
  }

  private static createContainerEnvironment(): HostEnvironment {
    const workspaceFolder = this.config.get<string>('containerWorkspaceFolder');
    const paths: string[] = [];
    
    // Check common mount points
    const mountPoints = [
      '/workspace/.claude/projects',
      '/app/.claude/projects',
      '/home/vscode/.claude/projects',
      '/home/node/.claude/projects'
    ];
    
    if (workspaceFolder) {
      mountPoints.unshift(
        path.join(workspaceFolder, '.claude', 'projects'),
        path.join(workspaceFolder, '.config', 'claude', 'projects')
      );
    }
    
    // Also check current workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        mountPoints.unshift(
          path.join(folder.uri.fsPath, '.claude', 'projects'),
          path.join(folder.uri.fsPath, '.config', 'claude', 'projects')
        );
      }
    }
    
    // Only add paths that exist
    for (const mountPoint of mountPoints) {
      if (fs.existsSync(mountPoint)) {
        paths.push(mountPoint);
      }
    }
    
    return {
      type: 'container',
      claudePaths: paths,
      pathResolver: (relativePath: string) => path.resolve(relativePath)
    };
  }

  static async validateClaudePaths(environment: HostEnvironment): Promise<string[]> {
    const validPaths: string[] = [];
    
    for (const claudePath of environment.claudePaths) {
      try {
        const resolvedPath = environment.pathResolver(claudePath);
        if (fs.existsSync(resolvedPath)) {
          const stat = fs.statSync(resolvedPath);
          if (stat.isDirectory()) {
            validPaths.push(resolvedPath);
          }
        }
      } catch (error) {
        this.log(`Cannot access Claude path ${claudePath}: ${error}`);
      }
    }
    
    return validPaths;
  }

  static async showEnvironmentStatus() {
    // Refresh config
    this.config = vscode.workspace.getConfiguration('ccusage');
    this.verboseLogging = this.config.get<boolean>('verboseLogging', false);
    
    const environment = await this.resolveExecutionHost();
    const validPaths = await this.validateClaudePaths(environment);
    
    // Count JSONL files in valid paths
    let fileCount = 0;
    let projectCount = 0;
    
    for (const validPath of validPaths) {
      try {
        const entries = fs.readdirSync(validPath, { withFileTypes: true });
        const projects = entries.filter(e => e.isDirectory());
        projectCount += projects.length;
        
        for (const project of projects) {
          const projectPath = path.join(validPath, project.name);
          const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
          fileCount += files.length;
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Get current settings
    const settings = [
      `Quick Mode: ${this.config.get<boolean>('quickMode', true) ? 'Enabled' : 'Disabled'}`,
      `WSL Detection: ${this.config.get<boolean>('enableWSLDetection', false) ? 'Enabled' : 'Disabled'}`,
      `Stop on First: ${this.config.get<boolean>('stopOnFirstValidPath', true) ? 'Yes' : 'No'}`,
      `Verbose Logging: ${this.config.get<boolean>('verboseLogging', false) ? 'Enabled' : 'Disabled'}`
    ];
    
    // Additional environment-specific information
    let additionalInfo = '';
    if (environment.type === 'wsl') {
      const wslInfo = [
        `WSL Distribution: ${process.env.WSL_DISTRO_NAME || 'Unknown'}`,
        `Linux Home: ${os.homedir()}`
      ];
      additionalInfo = '\n\nWSL Details:\n' + wslInfo.map(info => `  ${info}`).join('\n');
    }
    
    const statusMessage = [
      `Environment: ${environment.type.toUpperCase()}`,
      `Valid Claude paths found: ${validPaths.length}`,
      `Projects found: ${projectCount}`,
      `JSONL files found: ${fileCount}`,
      '',
      'Current Settings:',
      ...settings.map(s => `  ${s}`),
      '',
      'Valid paths:',
      ...validPaths.map(p => `  ✅ ${p}`),
      additionalInfo
    ].join('\n');
    
    vscode.window.showInformationMessage(
      `Claude Usage Tracker Environment Status:\n${statusMessage}`,
      { modal: true },
      'OK'
    );
  }
}