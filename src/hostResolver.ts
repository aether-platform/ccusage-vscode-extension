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

  private static prioritizeWSLUsers(userDirs: string[]): string[] {
    // Create a prioritized list of users based on various heuristics
    const prioritized: Array<{ name: string, score: number }> = [];
    
    for (const userDir of userDirs) {
      let score = 0;
      
      try {
        const userPath = `/mnt/c/Users/${userDir}`;
        
        // Higher priority for users with Claude data
        const claudePaths = [
          path.join(userPath, 'AppData', 'Roaming', 'claude'),
          path.join(userPath, '.claude'),
          path.join(userPath, '.config', 'claude')
        ];
        
        for (const claudePath of claudePaths) {
          if (fs.existsSync(claudePath)) {
            score += 100;
            // Extra points if it contains projects or actual usage data
            if (fs.existsSync(path.join(claudePath, 'projects'))) {
              score += 50;
            }
          }
        }
        
        // Higher priority for users with VS Code data
        if (fs.existsSync(path.join(userPath, 'AppData', 'Roaming', 'Code'))) {
          score += 20;
        }
        
        // Higher priority for users with recent activity
        const stat = fs.statSync(userPath);
        const daysSinceModified = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7) {
          score += 30;
        } else if (daysSinceModified < 30) {
          score += 10;
        }
        
        // Lower priority for system/service accounts
        if (userDir.toLowerCase().includes('system') || 
            userDir.toLowerCase().includes('service') ||
            userDir.toLowerCase().includes('admin') ||
            userDir.startsWith('_')) {
          score -= 50;
        }
        
        // Higher priority for common personal account names
        if (userDir.toLowerCase().match(/^[a-z]+$/)) {
          score += 5;
        }
        
      } catch (error) {
        // If we can't access the directory, give it very low priority
        score = -100;
      }
      
      prioritized.push({ name: userDir, score });
    }
    
    // Sort by score (highest first) and return names
    return prioritized
      .sort((a, b) => b.score - a.score)
      .map(item => item.name);
  }

  private static detectWindowsUsername(): string[] {
    const detectedUsers: string[] = [];
    
    try {
      // Method 1: Check Windows registry via wslpath
      const child_process = require('child_process');
      
      // Try to get Windows username from whoami.exe if available
      try {
        const result = child_process.execSync('cmd.exe /c whoami 2>/dev/null', { 
          encoding: 'utf8', 
          timeout: 5000 
        });
        const username = result.trim().split('\\').pop();
        if (username && !detectedUsers.includes(username)) {
          detectedUsers.push(username);
        }
      } catch (error) {
        // Ignore error, try next method
      }
      
      // Method 2: Parse from Windows environment variables accessible via cmd
      try {
        const result = child_process.execSync('cmd.exe /c echo %USERNAME% 2>/dev/null', { 
          encoding: 'utf8', 
          timeout: 5000 
        });
        const username = result.trim();
        if (username && username !== '%USERNAME%' && !detectedUsers.includes(username)) {
          detectedUsers.push(username);
        }
      } catch (error) {
        // Ignore error, try next method
      }
      
      // Method 3: Check for typical Windows user profile patterns
      try {
        const windowsUserDir = '/mnt/c/Users';
        if (fs.existsSync(windowsUserDir)) {
          const userDirs = fs.readdirSync(windowsUserDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
            .filter(dirent => !['Default', 'Public', 'All Users'].includes(dirent.name))
            .map(dirent => dirent.name);
          
          // Find users with the most recent VS Code or Claude activity
          const recentUsers = userDirs
            .map(userDir => {
              try {
                const userPath = `/mnt/c/Users/${userDir}`;
                const claudePath = path.join(userPath, 'AppData', 'Roaming', 'claude');
                const vscodePath = path.join(userPath, 'AppData', 'Roaming', 'Code');
                
                let lastActivity = 0;
                if (fs.existsSync(claudePath)) {
                  lastActivity = Math.max(lastActivity, fs.statSync(claudePath).mtime.getTime());
                }
                if (fs.existsSync(vscodePath)) {
                  lastActivity = Math.max(lastActivity, fs.statSync(vscodePath).mtime.getTime());
                }
                
                return { name: userDir, lastActivity };
              } catch {
                return { name: userDir, lastActivity: 0 };
              }
            })
            .filter(user => user.lastActivity > 0)
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .slice(0, 2) // Top 2 most recent users
            .map(user => user.name);
          
          detectedUsers.push(...recentUsers.filter(user => !detectedUsers.includes(user)));
        }
      } catch (error) {
        // Ignore error
      }
      
    } catch (error) {
      console.warn('Could not detect Windows username:', error);
    }
    
    return detectedUsers;
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
    
    const claudePaths: string[] = [];
    
    // Try to find Windows user directories with enhanced detection
    try {
      const windowsUserDir = '/mnt/c/Users';
      if (fs.existsSync(windowsUserDir)) {
        const userDirs = fs.readdirSync(windowsUserDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
          .filter(dirent => !['Default', 'Public', 'All Users'].includes(dirent.name))
          .map(dirent => dirent.name);
        
        // Enhanced user directory prioritization
        const prioritizedUsers = this.prioritizeWSLUsers(userDirs);
        
        // Check each user directory for Claude data
        for (const userDir of prioritizedUsers) {
          const userPath = path.join(windowsUserDir, userDir);
          const candidatePaths = [
            path.join(userPath, '.claude', 'projects'),
            path.join(userPath, '.config', 'claude', 'projects'),
            path.join(userPath, 'AppData', 'Roaming', 'claude', 'projects'),
            path.join(userPath, 'AppData', 'Local', 'claude', 'projects')
          ];
          
          for (const candidatePath of candidatePaths) {
            if (fs.existsSync(candidatePath)) {
              claudePaths.push(candidatePath);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not access Windows user directories:', error);
    }
    
    // Also check specific environment-based paths with enhanced detection
    const manualUsername = config.get<string>('wslWindowsUsername');
    const detectedUsernames = this.detectWindowsUsername();
    
    const envBasedPaths = [
      process.env.USERPROFILE,
      manualUsername ? `/mnt/c/Users/${manualUsername}` : null,
      ...detectedUsernames.map(username => `/mnt/c/Users/${username}`),
      process.env.USERNAME ? `/mnt/c/Users/${process.env.USERNAME}` : null,
      process.env.USER ? `/mnt/c/Users/${process.env.USER}` : null,
    ].filter(Boolean) as string[];
    
    for (const basePath of envBasedPaths) {
      if (basePath && fs.existsSync(basePath)) {
        const candidatePaths = [
          path.join(basePath, '.claude', 'projects'),
          path.join(basePath, '.config', 'claude', 'projects'),
          path.join(basePath, 'AppData', 'Roaming', 'claude', 'projects'),
          path.join(basePath, 'AppData', 'Local', 'claude', 'projects')
        ];
        
        for (const candidatePath of candidatePaths) {
          if (fs.existsSync(candidatePath) && !claudePaths.includes(candidatePath)) {
            claudePaths.push(candidatePath);
          }
        }
      }
    }
    
    // Check Linux home directory in WSL
    const linuxHome = os.homedir();
    const linuxPaths = [
      path.join(linuxHome, '.claude', 'projects'),
      path.join(linuxHome, '.config', 'claude', 'projects')
    ];
    
    for (const linuxPath of linuxPaths) {
      if (!claudePaths.includes(linuxPath)) {
        claudePaths.push(linuxPath);
      }
    }
    
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
    
    // Additional WSL-specific information
    let additionalInfo = '';
    if (environment.type === 'wsl') {
      const wslInfo = [
        `WSL Distribution: ${process.env.WSL_DISTRO_NAME || 'Unknown'}`,
        `Linux Home: ${require('os').homedir()}`,
        `Windows Users accessible: ${require('fs').existsSync('/mnt/c/Users') ? 'Yes' : 'No'}`
      ];
      additionalInfo = '\n\nWSL Details:\n' + wslInfo.map(info => `  ${info}`).join('\n');
    }
    
    const statusMessage = [
      `Environment: ${environment.type.toUpperCase()}`,
      `Valid Claude paths found: ${validPaths.length}`,
      '',
      'Searched paths:',
      ...environment.claudePaths.map(p => `  ${validPaths.includes(p) ? '✅' : '❌'} ${p}`),
      additionalInfo
    ].join('\n');
    
    vscode.window.showInformationMessage(
      `Claude Usage Tracker Environment Status:\n${statusMessage}`,
      { modal: true },
      'OK'
    );
  }
}