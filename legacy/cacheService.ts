import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BrainTask {
  id: string;
  label: string;
  path: string;
  size: number;
  fileCount: number;
  createdAt: number;
}

export interface CacheInfo {
  brainSize: number;
  conversationsSize: number;
  codeContextSize: number;
  totalSize: number;
  brainCount: number;
  conversationsCount: number;
  brainTasks: BrainTask[];
}

export class CacheService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.gemini', 'antigravity');
  }

  public getBrainDir(): string {
    return path.join(this.baseDir, 'brain');
  }

  public getConversationsDir(): string {
    return path.join(this.baseDir, 'conversations');
  }

  public getCodeContextDir(): string {
    // Competitor logic suggests 'code_tracker/active' is the active context dir
    return path.join(this.baseDir, 'code_tracker', 'active');
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const stat = await fs.promises.stat(dirPath);
      if (!stat.isDirectory()) {
        return stat.size;
      }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const fileStat = await fs.promises.stat(fullPath);
          totalSize += fileStat.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  private async getFileCount(dirPath: string): Promise<number> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isFile()).length;
    } catch {
      return 0;
    }
  }

  private async getTaskLabel(taskPath: string, fallbackId: string): Promise<string> {
    try {
      const taskMdPath = path.join(taskPath, 'task.md');
      const content = await fs.promises.readFile(taskMdPath, 'utf-8');

      // Try to find "TaskName" in task_boundary calls or heading
      // Simple heuristic: First markdown heading
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('# ')) {
          return line.replace('# ', '').trim().substring(0, 50);
        }
      }

      // Fallback: first non-empty line
      const firstLine = lines.find(l => l.trim().length > 0);
      if (firstLine) {
        return firstLine.trim().substring(0, 30);
      }

      return fallbackId.substring(0, 8);
    } catch {
      return fallbackId.substring(0, 8);
    }
  }

  private async getBrainTasks(brainDir: string): Promise<BrainTask[]> {
    try {
      const entries = await fs.promises.readdir(brainDir, { withFileTypes: true });
      const tasks: BrainTask[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const taskPath = path.join(brainDir, entry.name);

        // Parallelize stat calls for performance
        const [size, fileCount, label, stat] = await Promise.all([
          this.getDirectorySize(taskPath),
          this.getFileCount(taskPath),
          this.getTaskLabel(taskPath, entry.name),
          fs.promises.stat(taskPath),
        ]);

        tasks.push({
          id: entry.name,
          label,
          path: taskPath,
          size,
          fileCount,
          createdAt: stat.birthtimeMs,
        });
      }

      return tasks.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  public async getCacheInfo(): Promise<CacheInfo> {
    const brainDir = this.getBrainDir();
    const conversationsDir = this.getConversationsDir();
    const codeContextDir = this.getCodeContextDir();

    const [brainSize, conversationsSize, codeContextSize, brainTasks, conversationsCount] =
      await Promise.all([
        this.getDirectorySize(brainDir),
        this.getDirectorySize(conversationsDir),
        this.getDirectorySize(codeContextDir),
        this.getBrainTasks(brainDir),
        this.getFileCount(conversationsDir),
      ]);

    return {
      brainSize,
      conversationsSize,
      codeContextSize,
      totalSize: brainSize + conversationsSize + codeContextSize,
      brainCount: brainTasks.length,
      conversationsCount,
      brainTasks,
    };
  }

  public async cleanCache(): Promise<void> {
    await Promise.all([
      this.cleanDirectory(this.getBrainDir()),
      this.cleanDirectory(this.getConversationsDir()),
      // Do NOT auto-clean code context as it might be expensive to rebuild
      // But maybe we should? Competitor does not seem to auto-clean it in the generic 'clean' command unless specified
    ]);
  }

  public async deleteTask(taskId: string): Promise<void> {
    const taskPath = path.join(this.getBrainDir(), taskId);
    await fs.promises.rm(taskPath, { recursive: true, force: true });
  }

  private async cleanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  }

  // ============================================
  // Smart Context Flush - Surgical Cache Control
  // ============================================

  /**
   * Get info about the active context that would be flushed.
   * Returns files that will be cleared without touching brain tasks.
   */
  public async getFlushPreview(): Promise<{
    conversationFiles: string[];
    codeContextFiles: string[];
    totalSize: number;
    willDelete: number;
  }> {
    const conversationsDir = this.getConversationsDir();
    const codeContextDir = this.getCodeContextDir();

    let conversationFiles: string[] = [];
    let codeContextFiles: string[] = [];
    let totalSize = 0;

    try {
      const convEntries = await fs.promises.readdir(conversationsDir, { withFileTypes: true });
      conversationFiles = convEntries
        .filter(e => e.isFile())
        .map(e => e.name);

      for (const file of conversationFiles) {
        try {
          const stat = await fs.promises.stat(path.join(conversationsDir, file));
          totalSize += stat.size;
        } catch { /* ignore */ }
      }
    } catch { /* dir doesn't exist */ }

    try {
      const codeEntries = await fs.promises.readdir(codeContextDir, { withFileTypes: true });
      codeContextFiles = codeEntries.map(e => e.name);

      for (const file of codeContextFiles) {
        try {
          const stat = await fs.promises.stat(path.join(codeContextDir, file));
          totalSize += stat.size;
        } catch { /* ignore */ }
      }
    } catch { /* dir doesn't exist */ }

    return {
      conversationFiles,
      codeContextFiles,
      totalSize,
      willDelete: conversationFiles.length + codeContextFiles.length
    };
  }

  /**
   * Smart Context Flush: Surgical cache clearing.
   *
   * Clears:
   * - Active conversation context (short-term memory)
   * - Code tracking cache (file embeddings)
   *
   * Preserves:
   * - Brain tasks (implementation plans, task.md files)
   * - Persistent session data
   *
   * Use this when the agent is stuck or context is polluted,
   * without losing your project's mission plans.
   */
  public async flushActiveContext(): Promise<{
    clearedConversations: number;
    clearedCodeContext: number;
    freedBytes: number;
  }> {
    const preview = await this.getFlushPreview();

    // Clear conversations (short-term agent memory)
    await this.cleanDirectory(this.getConversationsDir());

    // Clear code context cache (can be rebuilt by agent)
    await this.cleanDirectory(this.getCodeContextDir());

    return {
      clearedConversations: preview.conversationFiles.length,
      clearedCodeContext: preview.codeContextFiles.length,
      freedBytes: preview.totalSize
    };
  }

  /**
   * Format bytes for human display
   */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
