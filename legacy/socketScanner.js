"use strict";
/**
 * Universal Socket Scanner
 * Pure Node.js port detection that works in restricted environments.
 * No OS commands, no elevated permissions, no lsof/netstat dependencies.
 *
 * Works in: DevContainers, WSL, SSH remotes, corporate VDI, Codespaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketScanner = void 0;
exports.quickPortScan = quickPortScan;
const net = require("net");
const https = require("https");
/**
 * Scans a range of localhost ports using pure Node.js sockets.
 * No external dependencies or OS commands required.
 */
class SocketScanner {
    constructor(startPort = 8090, endPort = 8100, connectionTimeout = 500) {
        this.startPort = startPort;
        this.endPort = endPort;
        this.connectionTimeout = connectionTimeout;
    }
    /**
     * Scan port range and find active Antigravity server.
     * Returns the first port that responds to API handshake.
     */
    async scan(csrfToken) {
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
    async findOpenPorts() {
        const ports = [];
        for (let p = this.startPort; p <= this.endPort; p++) {
            ports.push(p);
        }
        const results = await Promise.all(ports.map(port => this.testPortOpen(port)));
        return results
            .filter(r => r.responsive)
            .sort((a, b) => a.port - b.port);
    }
    /**
     * Test if a port accepts TCP connections.
     */
    testPortOpen(port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;
            const cleanup = (responsive) => {
                if (resolved)
                    return;
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
    validateAntigravityPort(port, csrfToken) {
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
            const options = {
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
exports.SocketScanner = SocketScanner;
/**
 * Alternative: Scan common Antigravity ports without CSRF token.
 * Used when we only need to find IF a server is running.
 */
async function quickPortScan(startPort = 8090, endPort = 8100) {
    const scanner = new SocketScanner(startPort, endPort, 300);
    const ports = [];
    for (let p = startPort; p <= endPort; p++) {
        ports.push(p);
    }
    const results = await Promise.all(ports.map(async (port) => {
        const socket = new net.Socket();
        return new Promise((resolve) => {
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
    }));
    return results.filter((p) => p !== null);
}
//# sourceMappingURL=socketScanner.js.map