import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io;

/**
 * Socket.io server for live classes (chat, hand-raise, presence) and
 * direct user notifications. Supabase Realtime covers in-app notification
 * streaming; Socket.io powers the interactive virtual classroom.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.frontendUrl, methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    // Client passes the Clerk session token; verified server-side in the route
    // that mints the socket ticket. Here we require the auth payload to exist.
    const auth = socket.handshake.auth || {};
    if (!auth.userId) return next(new Error('unauthorized'));
    socket.data.userId = auth.userId;
    socket.data.role = auth.role || 'student';
    next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);

    // ---- Live class rooms ----------------------------------------------
    socket.on('class:join', ({ classId }) => {
      socket.classId = classId;
      socket.join(`class:${classId}`);
      socket.to(`class:${classId}`).emit('class:participant-joined', { userId });
    });
    socket.on('class:leave', () => {
      if (socket.classId) socket.to(`class:${socket.classId}`).emit('class:participant-left', { userId });
    });
    socket.on('class:message', ({ classId, text }) => {
      io.to(`class:${classId}`).emit('class:message', { userId, text, at: Date.now() });
    });
    socket.on('class:hand-raise', ({ classId, raised }) => {
      io.to(`class:${classId}`).emit('class:hand-raise', { userId, raised });
    });
    socket.on('class:signal', ({ to, data }) => {
      io.to(`user:${to}`).emit('class:signal', { from: userId, data });
    });
    socket.on('class:screen-share', ({ classId, sharing }) => {
      socket.to(`class:${classId}`).emit('class:screen-share', { userId, sharing });
    });

    socket.on('disconnect', () => {
      if (socket.classId) socket.to(`class:${socket.classId}`).emit('class:participant-left', { userId });
    });
  });

  return io;
}

export function getIo() {
  return io;
}

/** Broadcast to every participant of a live class room. */
export function emitToClass(classId, event, payload) {
  io?.to(`class:${classId}`).emit(event, payload);
}

/** Send a socket notification to a single user room. */
export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
