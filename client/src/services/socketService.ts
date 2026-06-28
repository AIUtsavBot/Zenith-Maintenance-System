import { io, Socket } from 'socket.io-client';
import { getToken } from '../api.js';

let socket: Socket | null = null;
const eventListeners = new Map<string, Set<(data: any) => void>>();

export function getSocket(): Socket | null {
  return socket;
}

export function initSocketConnection(onEvent?: (event: string, data: any) => void): Socket | null {
  if (socket) return socket;

  const token = getToken();
  if (!token) return null;

  // Derive Socket server URL: if front-end is on port 5173, backend is on port 5000
  let socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
  
  if (!socketUrl) {
    if (window.location.port === '5173') {
      socketUrl = 'http://localhost:5000';
    } else if (window.location.hostname.includes('vercel.app')) {
      socketUrl = 'https://zenith-maintenance-system.onrender.com';
    }
  }

  if (socketUrl.endsWith('/api')) {
    socketUrl = socketUrl.slice(0, -4);
  }

  socket = io(socketUrl, {
    auth: { token },
    query: { token },
    transports: ['websocket', 'polling'] // fallback to polling
  });

  socket.on('connect', () => {
    console.log('Socket.IO connection established with backend.');
  });

  const supportedEvents = [
    'notification_added', 
    'toast_message', 
    'task_created', 
    'task_updated', 
    'task_completed', 
    'goal_created', 
    'goal_updated', 
    'member_joined', 
    'member_left'
  ];

  for (const ev of supportedEvents) {
    socket.on(ev, (data) => {
      const listeners = eventListeners.get(ev);
      if (listeners) {
        listeners.forEach(cb => cb(data));
      }
      if (onEvent) {
        onEvent(ev, data);
      }
    });
  }

  socket.on('disconnect', () => {
    console.log('Socket.IO connection disconnected.');
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToSocketEvent(event: string, callback: (data: any) => void) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);
}

export function unsubscribeFromSocketEvent(event: string, callback: (data: any) => void) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.delete(callback);
  }
}

/**
 * Play a synthesized double-ping chime using Web Audio API (zero external assets needed)
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    // Double tone chime
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('Web Audio playback blocked or unsupported:', e);
  }
}

/**
 * Triggers native HTML5 web browser push notification if permitted
 */
export function triggerBrowserNotification(title: string, body: string, metadata?: any) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: metadata?.notificationId || 'zenith-focus-alert'
    });

    notification.onclick = () => {
      window.focus();
      // Handle page routing redirection if clicked
      if (metadata?.taskId) {
        window.location.hash = `#task-${metadata.taskId}`;
      }
    };
  }
}
