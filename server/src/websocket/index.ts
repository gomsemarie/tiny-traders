import type { Server as SocketServer } from 'socket.io';
import { getLatestQuotes } from '../services/trading/price-simulator';

export function setupWebSocket(io: SocketServer): void {
  // Start broadcasting prices every 3 seconds
  setInterval(() => {
    const quotes = getLatestQuotes();
    if (quotes.length > 0) {
      io.emit('price:update', quotes);
    }
  }, 3000);

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Send current quotes immediately on subscribe
    socket.on('price:subscribe', () => {
      const quotes = getLatestQuotes();
      socket.emit('price:update', quotes);
    });

    // Phase 2+: 채팅, 실시간 시세, 이벤트 알림 등
    socket.on('chat:message', (data) => {
      io.emit('chat:message', {
        ...data,
        senderId: socket.id,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });
}
