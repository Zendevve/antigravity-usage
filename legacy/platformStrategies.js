"use strict";
/**
 * Platform-Specific Strategies for Process Detection
 * Based on Henrik-3/AntigravityQuota implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnixStrategy = exports.WindowsStrategy = void 0;
exports.getPlatformConfig = getPlatformConfig;
const process = require("process");
/**
 * Determine if a command line belongs to an Antigravity process
 * Checks for --app_data_dir antigravity parameter or antigravity in the path
 */
function isAntigravityProcess(commandLine) {
    const lowerCmd = commandLine.toLowerCase();
    if (/--app_data_dir\s+antigravity\b/i.test(commandLine)) {
        return true;
    }
    if (lowerCmd.includes('\\antigravity\\') || lowerCmd.includes('/antigravity/')) {
        return true;
    }
    return false;
}
/**
 * Windows Platform Strategy
 * Uses PowerShell for process detection and netstat for port listing
 */
class WindowsStrategy {
    getProcessListCommand(processName) {
        return `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='${processName}'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
    }
    parseProcessInfo(stdout) {
        try {
            const trimmed = stdout.trim();
            if (!trimmed || trimmed === '') {
                return null;
            }
            let data = JSON.parse(trimmed);
            // Handle array of processes
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    return null;
                }
                // Filter for Antigravity processes
                const antigravityProcesses = data.filter((item) => item.CommandLine && isAntigravityProcess(item.CommandLine));
                console.log(`[WindowsStrategy] Found ${data.length} language_server process(es), ${antigravityProcesses.length} belong to Antigravity`);
                if (antigravityProcesses.length === 0) {
                    console.log('[WindowsStrategy] No Antigravity process found');
                    return null;
                }
                data = antigravityProcesses[0];
            }
            else {
                // Single process object
                if (!data.CommandLine || !isAntigravityProcess(data.CommandLine)) {
                    console.log('[WindowsStrategy] Single process found but not Antigravity, skipping');
                    return null;
                }
            }
            const commandLine = data.CommandLine || '';
            const pid = data.ProcessId;
            if (!pid) {
                return null;
            }
            // Parse extension_server_port
            const portMatch = commandLine.match(/--extension_server_port[=\s]+(\d+)/);
            const extensionPort = portMatch ? parseInt(portMatch[1], 10) : 0;
            // Parse csrf_token (NOT local_server_csrf_token!)
            const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);
            const csrfToken = tokenMatch ? tokenMatch[1] : '';
            if (!csrfToken) {
                console.log('[WindowsStrategy] Could not extract CSRF token from command line');
                return null;
            }
            console.log(`[WindowsStrategy] Found Antigravity process PID: ${pid}`);
            return { pid, extensionPort, csrfToken };
        }
        catch (e) {
            console.error('[WindowsStrategy] Failed to parse process info:', e);
            return null;
        }
    }
    getPortListCommand(pid) {
        return `netstat -ano | findstr "${pid}" | findstr "LISTENING"`;
    }
    parseListeningPorts(stdout) {
        const portRegex = /(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)\s+\S+\s+LISTENING/gi;
        const ports = [];
        let match;
        while ((match = portRegex.exec(stdout)) !== null) {
            const port = parseInt(match[1], 10);
            if (!ports.includes(port)) {
                ports.push(port);
            }
        }
        return ports.sort((a, b) => a - b);
    }
    getErrorMessages() {
        return {
            processNotFound: 'Antigravity language_server process not found',
            commandNotAvailable: 'PowerShell command failed; please check system permissions',
            requirements: [
                'Antigravity extension is installed and running',
                'You are signed in to Antigravity',
                'System has permission to run PowerShell and netstat commands'
            ]
        };
    }
}
exports.WindowsStrategy = WindowsStrategy;
/**
 * Unix Platform Strategy (macOS and Linux)
 * Uses pgrep for process detection and lsof/ss for port listing
 */
class UnixStrategy {
    constructor(platform) {
        this.platform = platform;
    }
    getProcessListCommand(processName) {
        return `pgrep -fl ${processName}`;
    }
    parseProcessInfo(stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.includes('--extension_server_port') && isAntigravityProcess(line)) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[0], 10);
                const cmd = line.substring(parts[0].length).trim();
                const portMatch = cmd.match(/--extension_server_port[=\s]+(\d+)/);
                const tokenMatch = cmd.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);
                return {
                    pid,
                    extensionPort: portMatch ? parseInt(portMatch[1], 10) : 0,
                    csrfToken: tokenMatch ? tokenMatch[1] : ''
                };
            }
        }
        return null;
    }
    getPortListCommand(pid) {
        if (this.platform === 'darwin') {
            return `lsof -iTCP -sTCP:LISTEN -n -P -p ${pid}`;
        }
        return `ss -tlnp 2>/dev/null | grep "pid=${pid}" || lsof -iTCP -sTCP:LISTEN -n -P -p ${pid} 2>/dev/null`;
    }
    parseListeningPorts(stdout) {
        const ports = [];
        if (this.platform === 'darwin') {
            const lsofRegex = /(?:TCP|UDP)\s+(?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s+\(LISTEN\)/gi;
            let match;
            while ((match = lsofRegex.exec(stdout)) !== null) {
                const port = parseInt(match[1], 10);
                if (!ports.includes(port)) {
                    ports.push(port);
                }
            }
        }
        else {
            // Linux: try ss format first, then lsof
            const ssRegex = /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+)/gi;
            let match;
            while ((match = ssRegex.exec(stdout)) !== null) {
                const port = parseInt(match[1], 10);
                if (!ports.includes(port)) {
                    ports.push(port);
                }
            }
            if (ports.length === 0) {
                const lsofRegex = /(?:TCP|UDP)\s+(?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s+\(LISTEN\)/gi;
                while ((match = lsofRegex.exec(stdout)) !== null) {
                    const port = parseInt(match[1], 10);
                    if (!ports.includes(port)) {
                        ports.push(port);
                    }
                }
            }
        }
        return ports.sort((a, b) => a - b);
    }
    getErrorMessages() {
        return {
            processNotFound: 'Antigravity process not found',
            commandNotAvailable: 'pgrep/lsof command failed',
            requirements: [
                'Antigravity extension is installed and running',
                'You are signed in to Antigravity',
                'lsof or ss command is available'
            ]
        };
    }
}
exports.UnixStrategy = UnixStrategy;
/**
 * Get the appropriate platform strategy and process name
 */
function getPlatformConfig() {
    if (process.platform === 'win32') {
        return {
            strategy: new WindowsStrategy(),
            processName: 'language_server_windows_x64.exe'
        };
    }
    else if (process.platform === 'darwin') {
        return {
            strategy: new UnixStrategy('darwin'),
            processName: process.arch === 'arm64' ? 'language_server_macos_arm' : 'language_server_macos'
        };
    }
    else {
        return {
            strategy: new UnixStrategy('linux'),
            processName: 'language_server_linux'
        };
    }
}
//# sourceMappingURL=platformStrategies.js.map