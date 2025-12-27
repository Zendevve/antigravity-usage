/**
 * QuotaFetcher - Network Layer
 *
 * Consolidates port detection, process scanning, and API communication.
 * Merges: portDetector.ts, socketScanner.ts, platformStrategies.ts, quotaService.ts
 *
 * Laws of UX Applied:
 * - Doherty Threshold: Optimized for < 400ms response time
 * - Invisible by Default: Auto-detection, no user configuration needed
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import * as net from 'net';
import { ModelQuota, CreditInfo } from './types';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface ProcessInfo {
  pid: number;
  extensionPort: number;
  csrfToken: string;
}

interface ConnectionParams {
  port: number;
  csrfToken: string;
}

interface RawQuotaResponse {
  timestamp: Date;
  models: ModelQuota[];
  promptCredits?: CreditInfo;
  flowCredits?: CreditInfo;
  userInfo?: {
    name: string;
    email: string;
    planName: string;
    tier: string;
  };
}

// ============================================================================
// Platform Configuration
// ============================================================================

function getPlatformConfig(): { processName: string; isWindows: boolean } {
  if (process.platform === 'win32') {
    return { processName: 'language_server_windows_x64.exe', isWindows: true };
  } else if (process.platform === 'darwin') {
    const name = process.arch === 'arm64'
      ? 'language_server_macos_arm'
      : 'language_server_macos';
    return { processName: name, isWindows: false };
  } else {
    return { processName: 'language_server_linux', isWindows: false };
  }
}

// ============================================================================
// QuotaFetcher Class
// ============================================================================

export class QuotaFetcher {
  private connection: ConnectionParams | null = null;
  private processName: string;
  private isWindows: boolean;

  // Scan range for port detection
  private readonly PORT_START = 8090;
  private readonly PORT_END = 8150;
  private readonly SOCKET_TIMEOUT = 500;

  constructor() {
    const config = getPlatformConfig();
    this.processName = config.processName;
    this.isWindows = config.isWindows;
  }

  /**
   * Check if connected to the Antigravity language server
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Detect and connect to the Antigravity language server
   * Uses hybrid approach: socket scan first, then OS commands
   */
  async connect(maxRetries = 3): Promise<boolean> {
    console.log('[QuotaFetcher] Starting connection detection...');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Step 1: Get CSRF token from process
        const processInfo = await this.getProcessInfo();
        if (!processInfo?.csrfToken) {
          console.log(`[QuotaFetcher] Attempt ${attempt}: No process with CSRF token found`);
          if (attempt < maxRetries) {
            await this.delay(2000);
          }
          continue;
        }

        console.log(`[QuotaFetcher] Found CSRF token: ${processInfo.csrfToken.substring(0, 8)}...`);

        // Step 2: Find working API port via socket scan
        const port = await this.findApiPort(processInfo.csrfToken);
        if (!port) {
          console.log(`[QuotaFetcher] Attempt ${attempt}: No working API port found`);
          if (attempt < maxRetries) {
            await this.delay(2000);
          }
          continue;
        }

        this.connection = { port, csrfToken: processInfo.csrfToken };
        console.log(`[QuotaFetcher] Connected to port ${port}`);
        return true;

      } catch (error: any) {
        console.error(`[QuotaFetcher] Attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) {
          await this.delay(2000);
        }
      }
    }

    console.error('[QuotaFetcher] All connection attempts failed');
    return false;
  }

  /**
   * Fetch quota data from the API
   * Returns raw model quotas and credits
   */
  async fetch(): Promise<RawQuotaResponse | null> {
    if (!this.connection) {
      const connected = await this.connect();
      if (!connected) {
        return null;
      }
    }

    try {
      const response = await this.makeApiRequest();
      return this.parseResponse(response);
    } catch (error: any) {
      console.error('[QuotaFetcher] API request failed:', error.message);

      // Connection might be stale, reset and try again next time
      this.connection = null;
      return null;
    }
  }

  /**
   * Force reconnection (e.g., after process restart)
   */
  reset(): void {
    this.connection = null;
  }

  // ============================================================================
  // Private: Process Detection
  // ============================================================================

  private async getProcessInfo(): Promise<ProcessInfo | null> {
    try {
      if (this.isWindows) {
        return await this.getWindowsProcessInfo();
      } else {
        return await this.getUnixProcessInfo();
      }
    } catch (error: any) {
      console.log(`[QuotaFetcher] Process detection error: ${error.message}`);
      return null;
    }
  }

  private async getWindowsProcessInfo(): Promise<ProcessInfo | null> {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='${this.processName}'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd, { timeout: 10000 });

    const trimmed = stdout.trim();
    if (!trimmed) return null;

    let data = JSON.parse(trimmed);

    // Handle array of processes
    if (Array.isArray(data)) {
      data = data.find((item: any) =>
        item.CommandLine && this.isAntigravityProcess(item.CommandLine)
      );
    } else if (!data.CommandLine || !this.isAntigravityProcess(data.CommandLine)) {
      return null;
    }

    if (!data) return null;

    const commandLine = data.CommandLine || '';
    const pid = data.ProcessId;

    const portMatch = commandLine.match(/--extension_server_port[=\s]+(\d+)/);
    const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

    if (!tokenMatch) return null;

    return {
      pid,
      extensionPort: portMatch ? parseInt(portMatch[1], 10) : 0,
      csrfToken: tokenMatch[1],
    };
  }

  private async getUnixProcessInfo(): Promise<ProcessInfo | null> {
    const cmd = `pgrep -fl ${this.processName}`;
    const { stdout } = await execAsync(cmd, { timeout: 10000 });

    for (const line of stdout.split('\n')) {
      if (line.includes('--extension_server_port') && this.isAntigravityProcess(line)) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0], 10);

        const portMatch = line.match(/--extension_server_port[=\s]+(\d+)/);
        const tokenMatch = line.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);

        return {
          pid,
          extensionPort: portMatch ? parseInt(portMatch[1], 10) : 0,
          csrfToken: tokenMatch ? tokenMatch[1] : '',
        };
      }
    }

    return null;
  }

  private isAntigravityProcess(commandLine: string): boolean {
    const lowerCmd = commandLine.toLowerCase();
    if (/--app_data_dir\s+antigravity\b/i.test(commandLine)) return true;
    if (lowerCmd.includes('\\antigravity\\') || lowerCmd.includes('/antigravity/')) return true;
    return false;
  }

  // ============================================================================
  // Private: Port Scanning
  // ============================================================================

  private async findApiPort(csrfToken: string): Promise<number | null> {
    console.log(`[QuotaFetcher] Scanning ports ${this.PORT_START}-${this.PORT_END}...`);

    // Parallel port check for speed (Doherty Threshold)
    const portChecks = [];
    for (let port = this.PORT_START; port <= this.PORT_END; port++) {
      portChecks.push(this.checkPort(port, csrfToken));
    }

    const results = await Promise.all(portChecks);
    const workingPort = results.find(r => r.works);

    return workingPort ? workingPort.port : null;
  }

  private async checkPort(port: number, csrfToken: string): Promise<{ port: number; works: boolean }> {
    // First check if port is open via TCP
    const isOpen = await this.isPortOpen(port);
    if (!isOpen) {
      return { port, works: false };
    }

    // Then validate it's the right API
    const works = await this.testApiEndpoint(port, csrfToken);
    return { port, works };
  }

  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(this.SOCKET_TIMEOUT);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      try {
        socket.connect(port, '127.0.0.1');
      } catch {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  }

  private testApiEndpoint(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestBody = JSON.stringify({
        context: {
          properties: {
            devMode: 'false',
            extensionVersion: '',
            ide: 'antigravity',
            ideVersion: '1.11.2',
            installationId: 'test-detection',
            language: 'UNSPECIFIED',
            os: process.platform,
          },
        },
      });

      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': csrfToken,
        },
        rejectUnauthorized: false,
        timeout: 2000,
      };

      const req = https.request(options, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write(requestBody);
      req.end();
    });
  }

  // ============================================================================
  // Private: API Communication
  // ============================================================================

  private makeApiRequest(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('Not connected'));
        return;
      }

      const requestBody = JSON.stringify({
        metadata: {
          ideName: 'antigravity',
          extensionName: 'antigravity',
          locale: 'en',
        },
      });

      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.connection.port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': this.connection.csrfToken,
        },
        rejectUnauthorized: false,
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${data.substring(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  private parseResponse(data: any): RawQuotaResponse {
    const userStatus = data.userStatus || data;
    const planStatus = userStatus.planStatus;
    const cascadeData = userStatus.cascadeModelConfigData;

    // Parse credits
    const promptCredits = this.parseCredits(planStatus, 'Prompt');
    const flowCredits = this.parseCredits(planStatus, 'Flow');

    // Parse user info
    const userInfo = userStatus ? {
      name: userStatus.name || 'Unknown User',
      email: userStatus.email || '',
      planName: planStatus?.planInfo?.planName || 'Free',
      tier: userStatus.userTier?.name || planStatus?.planInfo?.teamsTier || 'Free',
    } : undefined;

    // Parse model quotas
    const models: ModelQuota[] = [];
    const rawModels = cascadeData?.clientModelConfigs || [];

    for (const model of rawModels) {
      if (!model.quotaInfo) continue;

      const remainingFraction = model.quotaInfo.remainingFraction ?? 1;
      const remainingPercent = Math.round(remainingFraction * 100);

      let resetTime: string | undefined;
      let timeUntilReset: string | undefined;

      if (model.quotaInfo.resetTime) {
        resetTime = model.quotaInfo.resetTime;
        const diff = new Date(resetTime!).getTime() - Date.now();
        timeUntilReset = this.formatTime(diff);
      }

      models.push({
        modelId: model.modelOrAlias?.model || model.modelOrAlias?.alias || 'unknown',
        label: model.label || 'Unknown Model',
        remainingPercent,
        isExhausted: remainingFraction === 0,
        resetTime,
        timeUntilReset,
      });
    }

    return {
      timestamp: new Date(),
      models,
      promptCredits,
      flowCredits,
      userInfo,
    };
  }

  private parseCredits(planStatus: any, type: 'Prompt' | 'Flow'): CreditInfo | undefined {
    if (!planStatus) return undefined;

    const available = Number(planStatus[`available${type}Credits`] || 0);
    const monthly = Number(planStatus.planInfo?.[`monthly${type}Credits`] || 0);

    if (monthly <= 0) return undefined;

    return { available, monthly };
  }

  private formatTime(ms: number): string {
    if (ms <= 0) return 'Ready';
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
