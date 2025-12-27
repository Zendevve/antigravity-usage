/**
 * Universal Socket Scanner
 * Pure Node.js port detection that works in restricted environments.
 * No OS commands, no elevated permissions, no lsof/netstat dependencies.
 *
 * Works in: DevContainers, WSL, SSH remotes, corporate VDI, Codespaces
 */

import * as net from 'net';
import * as https from 'https';

export interface ScanResult {
  port: number;
  csrfToken: string;
}

interface PortCandidate {
  port: number;
  responsive: boolean;
}

/**
 * Scans a range of localhost ports using pure Node.js sockets.
 * No external dependencies or OS commands required.
 */
export class SocketScanner {
  private readonly startPort: number;
  private readonly endPort: number;
  private readonly connectionTimeout: number;

  constructor(
    startPort: number = 8090,
    endPort: number = 8100,
    connectionTimeout: number = 500
  ) {
    this.startPort = startPort;
    this.endPort = endPort;
    this.connectionTimeout = connectionTimeout;
  }

  /**
   * Scan port range and find active Antigravity server.
   * Returns the first port that responds to API handshake.
   */
  async scan(csrfToken: string): Promise<ScanResult | null> {
    console.log(`[SocketScanner] Scanning ports ${this.startPort}-${this.endPort}...`);

    // Phase 1: Quick TCP connection test (parallel)
    const candidates = await this.findOpenPorts();

    if (candidates.length === 0) {
      console.log('[SocketScanner] No open ports found in range');
      return null;
    }

    console.log(`[SocketScanner] Found ${candidates.length} open ports: ${candidates.map(c => c.port).join(', ')}`);

    // Phase 2: Validate with API handshake (sequential)
    for (const candidate of candidates) {
      const isValid = await this.validateAntigravityPort(candidate.port, csrfToken);
      if (isValid) {
        console.log(`[SocketScanner] Validated Antigravity server on port ${candidate.port}`);
        return { port: candidate.port, csrfToken };
      }
    }

    console.log('[SocketScanner] No valid Antigravity server found');
    return null;
  }

  /**
   * Quick parallel scan to find all open ports in range.
   */
  private async findOpenPorts(): Promise<PortCandidate[]> {
    const ports: number[] = [];
    for (let p = this.startPort; p <= this.endPort; p++) {
      ports.push(p);
    }

    const results = await Promise.all(
      ports.map(port => this.testPortOpen(port))
    );

    return results
      .filter(r => r.responsive)
      .sort((a, b) => a.port - b.port);
  }

  /**
   * Test if a port accepts TCP connections.
   */
  private testPortOpen(port: number): Promise<PortCandidate> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = (responsive: boolean) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({ port, responsive });
      };

      socket.setTimeout(this.connectionTimeout);

      socket.on('connect', () => cleanup(true));
      socket.on('timeout', () => cleanup(false));
      socket.on('error', () => cleanup(false));

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Validate port is an Antigravity server by making API request.
   */
  private validateAntigravityPort(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestBody = JSON.stringify({
        context: {
          properties: {
            devMode: "false",
            extensionVersion: "",
            ide: "antigravity",
            ideVersion: "1.11.2",
            installationId: "socket-scanner",
            language: "UNSPECIFIED",
            os: process.platform
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
        res.resume(); // Drain response
        resolve(success);
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
}

/**
 * Alternative: Scan common Antigravity ports without CSRF token.
 * Used when we only need to find IF a server is running.
 */
export async function quickPortScan(
  startPort: number = 8090,
  endPort: number = 8100
): Promise<number[]> {
  const scanner = new SocketScanner(startPort, endPort, 300);
  const ports: number[] = [];

  for (let p = startPort; p <= endPort; p++) {
    ports.push(p);
  }

  const results = await Promise.all(
    ports.map(async (port) => {
      const socket = new net.Socket();
      return new Promise<number | null>((resolve) => {
        socket.setTimeout(300);
        socket.on('connect', () => {
          socket.destroy();
          resolve(port);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(null);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(null);
        });
        socket.connect(port, '127.0.0.1');
      });
    })
  );

  return results.filter((p): p is number => p !== null);
}
