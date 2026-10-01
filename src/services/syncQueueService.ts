import { getSyncQueue, removeSyncOperation, updateSyncOperation, saveLocalOrder } from '../db/indexedDB';
import { mockApi } from '../api/mockApi';
import type { SyncOperation } from '../types/order';

export interface SyncResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  conflicts: Array<{ operation: SyncOperation; serverOrder: any }>;
}

export async function processSyncQueue(): Promise<SyncResult> {
  const queue = await getSyncQueue();
  const pendingOps = queue.filter((op) => op.status === 'pending' || op.status === 'failed');

  const result: SyncResult = {
    totalProcessed: pendingOps.length,
    successCount: 0,
    failedCount: 0,
    conflicts: [],
  };

  if (!mockApi.isOnline()) {
    return result;
  }

  for (const op of pendingOps) {
    try {
      op.status = 'processing';
      await updateSyncOperation(op);

      const res = await mockApi.syncOperation(op);

      if (res.success) {
        if (res.order) {
          await saveLocalOrder(res.order);
        }
        await removeSyncOperation(op.id);
        result.successCount++;
      }
    } catch (err: any) {
      if (err.status === 409) {
        op.status = 'conflict';
        op.errorMessage = err.message || 'Conflito de versão no servidor.';
        await updateSyncOperation(op);
        result.failedCount++;
        result.conflicts.push({
          operation: op,
          serverOrder: err.serverOrder,
        });
      } else {
        op.retryCount = (op.retryCount || 0) + 1;
        op.status = 'failed';
        op.errorMessage = err.message || 'Erro desconhecido ao sincronizar.';
        await updateSyncOperation(op);
        result.failedCount++;
      }
    }
  }

  return result;
}
