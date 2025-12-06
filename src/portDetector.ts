/**
 * Process Port Detector
 * Detects Antigravity language server process and extracts connection params.
 * Based on wusimpl/AntigravityQuotaWatcher and Henrik-3/AntigravityQuota.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { getPlatformConfig, PlatformStrategy } from './platformStrategies';

const execAsync = promisify(exec);

export interface PortDetectionResult {
  connectPort: number;
  extensionPort: number;
  csrfToken: string;
}

export class PortDetector {
  private strategy: PlatformStrategy;
  private processName: string;

  constructor() {
    const config = getPlatformConfig();
    this.strategy = config.strategy;
    this.processName = config.processName;
  }

  /**
   * Detect port and CSRF token from running Antigravity process
   */
  async detect(maxRetries: number = 3, retryDelay: number = 2000): Promise<PortDetectionResult | null> {
    const errorMessages = this.strategy.getErrorMessages();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[PortDetector] Attempt ${attempt}/${maxRetries}: Detecting Antigravity process...`);

        // Step 1: Get process info (PID, extension_port, csrf_token)
        const command = this.strategy.getProcessListCommand(this.processName);
        console.log(`[PortDetector] Running: ${command}`);

        const { stdout } = await execAsync(command, { timeout: 15000 });
        const preview = stdout.trim().split('\n').slice(0, 3).join('\n');
        console.log(`[PortDetector] Output preview:\n${preview || '(empty)'}`);

        const processInfo = this.strategy.parseProcessInfo(stdout);

        if (!processInfo) {
          console.warn(`[PortDetector] ${errorMessages.processNotFound}`);
          throw new Error(errorMessages.processNotFound);
        }

        const { pid, extensionPort, csrfToken } = processInfo;
        console.log(`[PortDetector] Found PID: ${pid}, extensionPort: ${extensionPort}`);
        console.log(`[PortDetector] CSRF Token: ${csrfToken.substring(0, 8)}...`);

        // Step 2: Get all listening ports for this PID
        console.log(`[PortDetector] Fetching listening ports for PID ${pid}...`);
        const listeningPorts = await this.getListeningPorts(pid);

        if (listeningPorts.length === 0) {
          console.warn(`[PortDetector] Process is not listening on any ports`);
          throw new Error('Process is not listening on any ports');
        }

        console.log(`[PortDetector] Found ${listeningPorts.length} listening ports: ${listeningPorts.join(', ')}`);

        // Step 3: Test each port to find the working API endpoint
        console.log('[PortDetector] Testing port connectivity...');
        const connectPort = await this.findWorkingPort(listeningPorts, csrfToken);

        if (!connectPort) {
          console.warn(`[PortDetector] All port tests failed`);
          throw new Error('Unable to find a working API port');
        }

        console.log(`[PortDetector] Success! API port: ${connectPort}`);
        return { connectPort, extensionPort, csrfToken };

      } catch (error: any) {
        console.error(`[PortDetector] Attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          console.log(`[PortDetector] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    console.error(`[PortDetector] All ${maxRetries} attempts failed`);
    console.error('[PortDetector] Please ensure:');
    errorMessages.requirements.forEach((req, i) => {
      console.error(`[PortDetector]   ${i + 1}. ${req}`);
    });

    return null;
  }

  /**
   * Get listening ports for a specific PID
   */
  private async getListeningPorts(pid: number): Promise<number[]> {
    try {
      const command = this.strategy.getPortListCommand(pid);
      console.log(`[PortDetector] Running: ${command}`);

      const { stdout } = await execAsync(command, { timeout: 5000 });
      const preview = stdout.trim().split('\n').slice(0, 5).join('\n');
      console.log(`[PortDetector] Port list output:\n${preview || '(empty)'}`);

      const ports = this.strategy.parseListeningPorts(stdout);
      console.log(`[PortDetector] Parsed ports: ${ports.join(', ') || '(none)'}`);
      return ports;

    } catch (error: any) {
      console.error('[PortDetector] Failed to get listening ports:', error.message);
      return [];
    }
  }

  /**
   * Find the first port that responds to API requests
   */
  private async findWorkingPort(ports: number[], csrfToken: string): Promise<number | null> {
    for (const port of ports) {
      console.log(`[PortDetector] Testing port ${port}...`);
      if (await this.testPort(port, csrfToken)) {
        console.log(`[PortDetector] Port ${port} is working!`);
        return port;
      }
    }
    return null;
  }

  /**
   * Test if a port responds to API requests
   * Uses GetUnleashData endpoint which works without user login
   */
  private testPort(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestBody = JSON.stringify({
        context: {
          properties: {
            devMode: "false",
            extensionVersion: "",
            ide: "antigravity",
            ideVersion: "1.11.2",
            installationId: "test-detection",
            language: "UNSPECIFIED",
            os: "windows"
          }
        }
      });

      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: port,
        path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': csrfToken
        },
        rejectUnauthorized: false,
        timeout: 2000
      };

      const req = https.request(options, (res) => {
        const success = res.statusCode === 200;
        console.log(`[PortDetector] Port ${port} responded with status ${res.statusCode}`);
        res.resume();
        resolve(success);
      });

      req.on('error', (err) => {
        console.log(`[PortDetector] Port ${port} error: ${err.message}`);
        resolve(false);
      });

      req.on('timeout', () => {
        console.log(`[PortDetector] Port ${port} timeout`);
        req.destroy();
        resolve(false);
      });

      req.write(requestBody);
      req.end();
    });
  }
}
