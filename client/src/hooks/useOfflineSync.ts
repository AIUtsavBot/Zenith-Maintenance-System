import { useState, useEffect } from 'react';
import { api } from '../api.js';

interface OfflineMutation {
  id: string;
  action: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_GOAL' | 'UPDATE_GOAL' | 'CREATE_REMINDER' | 'DELETE_REMINDER';
  payload: any;
  timestamp: number;
}

export function useOfflineSync(onSyncComplete?: () => void) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queue, setQueue] = useState<OfflineMutation[]>([]);

  useEffect(() => {
    // Load existing queue from localStorage
    const savedQueue = localStorage.getItem('zenith_offline_sync_queue');
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error('Error parsing offline queue:', e);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      console.log('App is back online. Replaying offline changes...');
      processSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('App is offline. Local caching enabled.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on boot
    if (navigator.onLine) {
      processSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveQueueToStorage = (updatedQueue: OfflineMutation[]) => {
    localStorage.setItem('zenith_offline_sync_queue', JSON.stringify(updatedQueue));
    setQueue(updatedQueue);
  };

  const enqueueOfflineMutation = (
    action: OfflineMutation['action'],
    payload: any
  ) => {
    const mutation: OfflineMutation = {
      id: Math.random().toString(36).substring(2, 9),
      action,
      payload,
      timestamp: Date.now()
    };

    const updatedQueue = [...queue, mutation];
    saveQueueToStorage(updatedQueue);
    console.log(`Offline mutation queued: ${action}`, payload);
  };

  const processSyncQueue = async () => {
    const savedQueue = localStorage.getItem('zenith_offline_sync_queue');
    if (!savedQueue) return;

    let currentQueue: OfflineMutation[] = [];
    try {
      currentQueue = JSON.parse(savedQueue);
    } catch {
      return;
    }

    if (currentQueue.length === 0) return;

    console.log(`Replaying offline queue: ${currentQueue.length} actions pending...`);
    const remainingQueue: OfflineMutation[] = [];

    for (const mutation of currentQueue) {
      try {
        switch (mutation.action) {
          case 'CREATE_TASK':
            await api.tasks.create(mutation.payload);
            break;
          case 'UPDATE_TASK':
            await api.tasks.update(mutation.payload.id, mutation.payload);
            break;
          case 'DELETE_TASK':
            await api.tasks.delete(mutation.payload.id);
            break;
          case 'CREATE_GOAL':
            await api.goals.create(mutation.payload);
            break;
          case 'UPDATE_GOAL':
            await api.goals.update(mutation.payload.id, mutation.payload);
            break;
          case 'CREATE_REMINDER':
            await api.reminders.create(mutation.payload);
            break;
          case 'DELETE_REMINDER':
            await api.reminders.delete(mutation.payload.id);
            break;
        }
        console.log(`Offline action synced: ${mutation.action}`);
      } catch (err: any) {
        console.error(`Offline sync failure for ${mutation.action}:`, err);
        // If network disconnect persists, retain in queue
        if (err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('status: 5'))) {
          remainingQueue.push(mutation);
        } else {
          // If conflict / authorization error (400, 403, 404), discard to prevent locking execution loop
          console.warn('Discarding conflict offline query to prevent sync locks.');
        }
      }
    }

    saveQueueToStorage(remainingQueue);

    if (remainingQueue.length === 0 && onSyncComplete) {
      onSyncComplete();
    }
  };

  return {
    isOnline,
    queueLength: queue.length,
    enqueueOfflineMutation,
    processSyncQueue
  };
}
