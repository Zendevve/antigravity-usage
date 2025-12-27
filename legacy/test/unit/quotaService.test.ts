import * as assert from 'assert';
import { QuotaService } from '../../quotaService';

describe('QuotaService Test Suite', () => {
  it('Service initializes without errors', () => {
    const service = new QuotaService();
    assert.ok(service, 'Service should instantiate');
  });

  it('Returns empty array when not connected', async () => {
    const service = new QuotaService();
    const data = await service.poll();
    assert.ok(Array.isArray(data), 'Should return an array');
    assert.strictEqual(data.length, 0, 'Should be empty when not connected');
  });

  it('getQuota returns cached data', () => {
    const service = new QuotaService();
    const data = service.getQuota();
    assert.ok(Array.isArray(data), 'Should return an array');
  });
});
