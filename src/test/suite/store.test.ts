import * as assert from 'assert';
import { QuotaStore } from '../../core/QuotaStore';
import { QuotaState } from '../../core/types';

suite('QuotaStore Test Suite', () => {
  let store: QuotaStore;

  setup(() => {
    store = new QuotaStore();
  });

  test('Initial state should be valid', () => {
    const state = store.getState();
    assert.strictEqual(state.models.length, 0);
    assert.strictEqual(state.isLoading, false);
    assert.strictEqual(state.error, null);
  });

  test('Should handle LOADING action', () => {
    store.dispatch({ type: 'LOADING' });
    assert.strictEqual(store.getState().isLoading, true);
  });

  test('Should handle ERROR action', () => {
    store.dispatch({ type: 'ERROR', payload: 'Connection failed' });
    assert.strictEqual(store.getState().isLoading, false);
    assert.strictEqual(store.getState().error, 'Connection failed');
  });

  test('Should handle UPDATE action', () => {
    const mockUpdate: any = {
      models: [],
      health: { score: 90, level: 'excellent', label: 'Excellent' },
      lastUpdate: new Date(),
      error: null
    };

    store.dispatch({ type: 'UPDATE', payload: mockUpdate });
    const state = store.getState();
    assert.strictEqual(state.isLoading, false);
    assert.strictEqual(state.health.score, 90);
    assert.strictEqual(state.error, null);
  });

  test('Should notify subscribers', () => {
    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    store.dispatch({ type: 'LOADING' });
    assert.strictEqual(callCount, 1);

    unsubscribe();
    store.dispatch({ type: 'CLEAR_ERROR' });
    assert.strictEqual(callCount, 1); // Should not increase
  });
});
