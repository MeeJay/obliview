import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { authService } from './services/auth.service';

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      // The session userId is passed via auth handshake
      const userId = socket.handshake.auth?.userId as number | undefined;

      if (!userId) {
        return next(new Error('Authentication required'));
      }

      const user = await authService.getUserById(userId);
      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${user.username} (id: ${user.id})`);

    // Join user-specific room
    socket.join(`user:${user.id}`);

    // Join role room
    if (user.role === 'admin') {
      socket.join('role:admin');
    }

    // All authenticated users join the general room
    socket.join('general');

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
}
