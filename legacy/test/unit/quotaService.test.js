"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const quotaService_1 = require("../../quotaService");
describe('QuotaService Test Suite', () => {
    it('Service initializes without errors', () => {
        const service = new quotaService_1.QuotaService();
        assert.ok(service, 'Service should instantiate');
    });
    it('Returns empty array when not connected', async () => {
        const service = new quotaService_1.QuotaService();
        const data = await service.poll();
        assert.ok(Array.isArray(data), 'Should return an array');
        assert.strictEqual(data.length, 0, 'Should be empty when not connected');
    });
    it('getQuota returns cached data', () => {
        const service = new quotaService_1.QuotaService();
        const data = service.getQuota();
        assert.ok(Array.isArray(data), 'Should return an array');
    });
});
//# sourceMappingURL=quotaService.test.js.map