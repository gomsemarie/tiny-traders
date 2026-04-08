import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(token?: string): void {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

/**
 * React hook to get the socket instance
 * Ensures socket is available in components
 */
export function useSocket(): Socket | null {
  const [s, setS] = useState<Socket | null>(null);

  useEffect(() => {
    const socketInstance = getSocket();
    setS(socketInstance);
  }, []);

  return s;
}
