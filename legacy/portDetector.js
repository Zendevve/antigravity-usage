"use strict";
/**
 * Process Port Detector
 * Detects Antigravity language server process and extracts connection params.
 *
 * v0.5.0: Hybrid detection strategy
 * 1. Primary: Pure Node.js socket scanner (works in DevContainers, WSL, SSH)
 * 2. Fallback: OS-specific commands (PowerShell/lsof) for PID-based discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortDetector = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const https = require("https");
const platformStrategies_1 = require("./platformStrategies");
const socketScanner_1 = require("./socketScanner");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class PortDetector {
    constructor() {
        const config = (0, platformStrategies_1.getPlatformConfig)();
        this.strategy = config.strategy;
        this.processName = config.processName;
        this.socketScanner = new socketScanner_1.SocketScanner(8090, 8150, 500);
    }
    /**
     * Detect port and CSRF token from running Antigravity process.
     * Uses hybrid approach: socket scanner first, then OS commands as fallback.
     */
    async detect(maxRetries = 3, retryDelay = 2000) {
        // Try socket scanner first (works in restricted environments)
        const socketResult = await this.detectWithSocketScanner();
        if (socketResult) {
            return socketResult;
        }
        // Fallback to OS-based detection
        console.log('[PortDetector] Socket scanner failed, falling back to OS commands...');
        return this.detectWithOSCommands(maxRetries, retryDelay);
    }
    /**
     * Primary detection: Pure Node.js socket scanner
     * Works in DevContainers, WSL, SSH, restricted environments
     */
    async detectWithSocketScanner() {
        console.log('[PortDetector] Attempting socket-based detection (universal method)...');
        try {
            // First, get CSRF token from process (still need OS for this)
            const command = this.strategy.getProcessListCommand(this.processName);
            const { stdout } = await execAsync(command, { timeout: 10000 });
            const processInfo = this.strategy.parseProcessInfo(stdout);
            if (!processInfo || !processInfo.csrfToken) {
                console.log('[PortDetector] Could not extract CSRF token from process');
                return null;
            }
            const { extensionPort, csrfToken } = processInfo;
            console.log(`[PortDetector] Got CSRF token: ${csrfToken.substring(0, 8)}...`);
            // Use socket scanner to find the API port
            const scanResult = await this.socketScanner.scan(csrfToken);
            if (scanResult) {
                console.log(`[PortDetector] Socket scanner found API port: ${scanResult.port}`);
                return {
                    connectPort: scanResult.port,
                    extensionPort: extensionPort || scanResult.port,
                    csrfToken: csrfToken
                };
            }
        }
        catch (error) {
            console.log(`[PortDetector] Socket scanner error: ${error.message}`);
        }
        return null;
    }
    /**
     * Fallback detection: OS-specific commands (PowerShell, lsof, netstat)
     * More reliable but requires specific tools installed
     */
    async detectWithOSCommands(maxRetries, retryDelay) {
        const errorMessages = this.strategy.getErrorMessages();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PortDetector] OS fallback attempt ${attempt}/${maxRetries}...`);
                const command = this.strategy.getProcessListCommand(this.processName);
                const { stdout } = await execAsync(command, { timeout: 15000 });
                const processInfo = this.strategy.parseProcessInfo(stdout);
                if (!processInfo) {
                    throw new Error(errorMessages.processNotFound);
                }
                const { pid, extensionPort, csrfToken } = processInfo;
                console.log(`[PortDetector] Found PID: ${pid}, extensionPort: ${extensionPort}`);
                const listeningPorts = await this.getListeningPorts(pid);
                if (listeningPorts.length === 0) {
                    throw new Error('Process is not listening on any ports');
                }
                const connectPort = await this.findWorkingPort(listeningPorts, csrfToken);
                if (!connectPort) {
                    throw new Error('Unable to find a working API port');
                }
                console.log(`[PortDetector] Success! API port: ${connectPort}`);
                return { connectPort, extensionPort, csrfToken };
            }
            catch (error) {
                console.error(`[PortDetector] Attempt ${attempt} failed:`, error.message);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        console.error(`[PortDetector] All detection methods failed`);
        return null;
    }
    /**
     * Get listening ports for a specific PID
     */
    async getListeningPorts(pid) {
        try {
            const command = this.strategy.getPortListCommand(pid);
            console.log(`[PortDetector] Running: ${command}`);
            const { stdout } = await execAsync(command, { timeout: 5000 });
            const preview = stdout.trim().split('\n').slice(0, 5).join('\n');
            console.log(`[PortDetector] Port list output:\n${preview || '(empty)'}`);
            const ports = this.strategy.parseListeningPorts(stdout);
            console.log(`[PortDetector] Parsed ports: ${ports.join(', ') || '(none)'}`);
            return ports;
        }
        catch (error) {
            console.error('[PortDetector] Failed to get listening ports:', error.message);
            return [];
        }
    }
    /**
     * Find the first port that responds to API requests
     */
    async findWorkingPort(ports, csrfToken) {
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
    testPort(port, csrfToken) {
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
exports.PortDetector = PortDetector;
//# sourceMappingURL=portDetector.js.map