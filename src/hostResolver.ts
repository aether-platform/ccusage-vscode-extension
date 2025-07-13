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
  
  static async resolveExecutionHost(): Promise<HostEnvironment> {
    const config = vscode.workspace.getConfiguration('ccusage');
    const executionHost = config.get<string>('executionHost', 'auto');
    
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
    // Check if running in Remote Container
    if (this.isRemoteContainer()) {
      return this.createContainerEnvironment();
    }
    
    // Check if running in WSL
    if (this.isWSL()) {
      return this.createWSLEnvironment();
    }
    
    // Default to local
    return this.createLocalEnvironment();
  }

  private static isRemoteContainer(): boolean {
    // Check for Remote Container indicators
    const remoteEnv = vscode.env.remoteName;
    const devContainer = process.env.DEVCONTAINER;
    const containerEnv = process.env.CONTAINER_ENV;
    
    return !!(remoteEnv === 'dev-container' || devContainer || containerEnv);
  }

  private static isWSL(): boolean {
    // Check for WSL indicators
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
    
    return {
      type: 'local',
      claudePaths: [
        path.join(homedir, '.claude', 'projects'),
        path.join(homedir, '.config', 'claude', 'projects')
      ],
      pathResolver: (relativePath: string) => path.resolve(relativePath)
    };
  }

  private static createWSLEnvironment(): HostEnvironment {
    const config = vscode.workspace.getConfiguration('ccusage');
    const wslDistro = config.get<string>('wslDistribution', 'Ubuntu');
    
    // For WSL, we need to access Windows home directory
    const windowsHomePaths = [
      `/mnt/c/Users/${process.env.USERNAME || process.env.USER}`,
      `/mnt/c/Users/${os.userInfo().username}`
    ];
    
    const claudePaths: string[] = [];
    
    for (const homePath of windowsHomePaths) {
      if (fs.existsSync(homePath)) {
        claudePaths.push(
          path.join(homePath, '.claude', 'projects'),
          path.join(homePath, '.config', 'claude', 'projects')
        );
        break;
      }
    }
    
    // Also check Linux home directory in WSL
    const linuxHome = os.homedir();
    claudePaths.push(
      path.join(linuxHome, '.claude', 'projects'),
      path.join(linuxHome, '.config', 'claude', 'projects')
    );
    
    return {
      type: 'wsl',
      claudePaths,
      pathResolver: (relativePath: string) => {
        // Handle both Windows and Linux paths in WSL
        if (relativePath.startsWith('/mnt/c')) {
          return relativePath;
        }
        return path.resolve(relativePath);
      }
    };
  }

  private static createContainerEnvironment(): HostEnvironment {
    const config = vscode.workspace.getConfiguration('ccusage');
    const workspaceFolder = config.get<string>('containerWorkspaceFolder');
    
    // In containers, Claude data might be mounted or in the workspace
    const claudePaths: string[] = [];
    
    // Check common mount points
    const mountPoints = [
      '/workspace/.claude/projects',
      '/app/.claude/projects',
      '/home/vscode/.claude/projects',
      '/home/node/.claude/projects'
    ];
    
    if (workspaceFolder) {
      mountPoints.push(
        path.join(workspaceFolder, '.claude', 'projects'),
        path.join(workspaceFolder, '.config', 'claude', 'projects')
      );
    }
    
    // Also check current workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        claudePaths.push(
          path.join(folder.uri.fsPath, '.claude', 'projects'),
          path.join(folder.uri.fsPath, '.config', 'claude', 'projects')
        );
      }
    }
    
    claudePaths.push(...mountPoints);
    
    return {
      type: 'container',
      claudePaths,
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
        console.warn(`Cannot access Claude path ${claudePath}:`, error);
      }
    }
    
    return validPaths;
  }

  static async showEnvironmentStatus() {
    const environment = await this.resolveExecutionHost();
    const validPaths = await this.validateClaudePaths(environment);
    
    const statusMessage = [
      `Environment: ${environment.type}`,
      `Valid Claude paths: ${validPaths.length}`,
      ...validPaths.map(p => `  - ${p}`)
    ].join('\n');
    
    vscode.window.showInformationMessage(
      `Claude Usage Tracker Environment:\n${statusMessage}`,
      'OK'
    );
  }
}