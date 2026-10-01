import { openDB, type IDBPDatabase } from 'idb';
import type { Order, SyncOperation } from '../types/order';

const DB_NAME = 'FidliOrdersDB';
const DB_VERSION = 1;

const STORES = {
  ORDERS: 'orders',
  SYNC_QUEUE: 'syncQueue',
};

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        const orderStore = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
        orderStore.createIndex('status', 'status');
        orderStore.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('createdAt', 'createdAt');
        syncStore.createIndex('status', 'status');
      }
    },
  });
}

export async function getLocalOrders(): Promise<Order[]> {
  const db = await getDB();
  return db.getAll(STORES.ORDERS);
}

export async function getLocalOrderById(id: string): Promise<Order | undefined> {
  const db = await getDB();
  return db.get(STORES.ORDERS, id);
}

export async function saveLocalOrder(order: Order): Promise<void> {
  const db = await getDB();
  await db.put(STORES.ORDERS, order);
}

export async function saveLocalOrdersBulk(orders: Order[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.ORDERS, 'readwrite');
  for (const order of orders) {
    await tx.store.put(order);
  }
  await tx.done;
}

export async function deleteLocalOrder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.ORDERS, id);
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  const db = await getDB();
  const ops = await db.getAllFromIndex(STORES.SYNC_QUEUE, 'createdAt');
  return ops;
}

export async function addSyncOperation(op: SyncOperation): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SYNC_QUEUE, op);
}

export async function updateSyncOperation(op: SyncOperation): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SYNC_QUEUE, op);
}

export async function removeSyncOperation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.SYNC_QUEUE, id);
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  await db.clear(STORES.ORDERS);
  await db.clear(STORES.SYNC_QUEUE);
}
