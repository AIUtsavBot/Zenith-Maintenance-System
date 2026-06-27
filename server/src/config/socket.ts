import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'productivity_secret_key_123!';

let io: Server | null = null;

// Map to track active user socket IDs: username -> socketId
const activeConnections = new Map<string, string>();

export function initSocketServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  });

  // Socket.IO authentication middleware
  io.use((socket, next) => {
    // Get token from auth payload or handshake query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      socket.data = { 
        username: decoded.username.toLowerCase(), 
        name: decoded.name, 
        role: decoded.role 
      };
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token invalid'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const username = socket.data.username;
    console.log(`Socket client connected: ${username} (${socket.id})`);

    activeConnections.set(username, socket.id);

    // Join personal user room to receive targeted notifications/triggers
    socket.join(`user_${username}`);

    // Join rooms for groups user is part of (triggered by client on app load)
    socket.on('join_group', (groupId: string) => {
      socket.join(`group_${groupId}`);
      console.log(`User ${username} joined group socket room: group_${groupId}`);
    });

    socket.on('leave_group', (groupId: string) => {
      socket.leave(`group_${groupId}`);
      console.log(`User ${username} left group socket room: group_${groupId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${username} (${socket.id})`);
      activeConnections.delete(username);
    });
  });

  return io;
}

export function getIoServer() {
  return io;
}

/**
 * Send real-time event to a specific user's personal channel
 */
export function sendToUser(username: string, event: string, payload: any) {
  if (io) {
    io.to(`user_${username.toLowerCase()}`).emit(event, payload);
  }
}

/**
 * Send real-time event to all connected members of a group room
 */
export function sendToGroup(groupId: string, event: string, payload: any) {
  if (io) {
    io.to(`group_${groupId}`).emit(event, payload);
  }
}

/**
 * Broadcast event to all connected users globally
 */
export function broadcastEvent(event: string, payload: any) {
  if (io) {
    io.emit(event, payload);
  }
}
