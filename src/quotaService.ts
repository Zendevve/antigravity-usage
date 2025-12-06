/**
 * Quota Service
 * Fetches and parses quota data from Antigravity API.
 * Based on Henrik-3/AntigravityQuota implementation.
 */

import * as https from 'https';

export interface ModelQuota {
  label: string;
  modelId: string;
  remainingPercent: number;
  usedPercent: number;
  isExhausted: boolean;
  resetTime?: Date;
  timeUntilReset?: string;
}

export interface PromptCredits {
  available: number;
  monthly: number;
  usedPercent: number;
  remainingPercent: number;
}

export interface QuotaSnapshot {
  timestamp: Date;
  promptCredits?: PromptCredits;
  models: ModelQuota[];
}

export class QuotaService {
  private _connectPort: number | undefined;
  private _csrfToken: string | undefined;
  private _lastSnapshot: QuotaSnapshot | undefined;

  constructor() { }

  public setConnection(port: number, csrfToken: string) {
    this._connectPort = port;
    this._csrfToken = csrfToken;
    console.log(`[QuotaService] Connection set: port=${port}, token=${csrfToken.substring(0, 8)}...`);
  }

  public async poll(): Promise<ModelQuota[]> {
    if (!this._connectPort || !this._csrfToken) {
      console.warn('[QuotaService] Missing port or CSRF token');
      return [];
    }

    try {
      console.log(`[QuotaService] Fetching quota from port ${this._connectPort}...`);
      const response = await this.makeRequest();
      console.log('[QuotaService] Response received, parsing...');

      const snapshot = this.parseResponse(response);
      this._lastSnapshot = snapshot;

      console.log(`[QuotaService] Parsed ${snapshot.models.length} models`);
      return snapshot.models;

    } catch (error: any) {
      console.error('[QuotaService] API Call Failed:', error.message);
      return [];
    }
  }

  public getSnapshot(): QuotaSnapshot | undefined {
    return this._lastSnapshot;
  }

  public getQuota(): ModelQuota[] {
    return this._lastSnapshot?.models || [];
  }

  private makeRequest(): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({
        metadata: {
          ideName: 'antigravity',
          extensionName: 'antigravity',
          locale: 'en'
        }
      });

      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: this._connectPort,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': this._csrfToken
        },
        rejectUnauthorized: false,
        timeout: 10000
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

      req.on('error', (error) => reject(error));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  private parseResponse(data: any): QuotaSnapshot {
    const userStatus = data.userStatus || data;
    const planStatus = userStatus.planStatus;
    const cascadeData = userStatus.cascadeModelConfigData;

    // Parse prompt credits
    let promptCredits: PromptCredits | undefined;
    if (planStatus) {
      const planInfo = planStatus.planInfo;
      const available = Number(planStatus.availablePromptCredits || 0);
      const monthly = Number(planInfo?.monthlyPromptCredits || 0);

      if (monthly > 0) {
        const used = monthly - available;
        promptCredits = {
          available,
          monthly,
          usedPercent: Math.round((used / monthly) * 100),
          remainingPercent: Math.round((available / monthly) * 100)
        };
        console.log(`[QuotaService] Prompt Credits: ${available}/${monthly} (${promptCredits.remainingPercent}% remaining)`);
      }
    }

    // Parse model quotas from cascadeModelConfigData.clientModelConfigs
    const models: ModelQuota[] = [];
    const rawModels = cascadeData?.clientModelConfigs || [];

    console.log(`[QuotaService] Found ${rawModels.length} model configs`);

    for (const model of rawModels) {
      // Only include models with quota info
      if (!model.quotaInfo) {
        continue;
      }

      const label = model.label || 'Unknown Model';
      const modelId = model.modelOrAlias?.model || model.modelOrAlias?.alias || 'unknown';
      const remainingFraction = model.quotaInfo.remainingFraction ?? 1;
      const remainingPercent = Math.round(remainingFraction * 100);
      const usedPercent = 100 - remainingPercent;
      const isExhausted = remainingFraction === 0;

      let resetTime: Date | undefined;
      let timeUntilReset: string | undefined;

      if (model.quotaInfo.resetTime) {
        resetTime = new Date(model.quotaInfo.resetTime);
        const diff = resetTime.getTime() - Date.now();
        timeUntilReset = this.formatTime(diff);
      }

      models.push({
        label,
        modelId,
        remainingPercent,
        usedPercent,
        isExhausted,
        resetTime,
        timeUntilReset
      });

      console.log(`[QuotaService] Model: ${label} - ${remainingPercent}% remaining (${timeUntilReset || 'no reset'})`);
    }

    return {
      timestamp: new Date(),
      promptCredits,
      models
    };
  }

  private formatTime(ms: number): string {
    if (ms <= 0) return 'Ready';
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
}
