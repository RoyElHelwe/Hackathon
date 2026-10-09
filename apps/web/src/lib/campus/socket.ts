'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * One Socket.IO connection per tab, through the same-origin /api proxy (so the httpOnly session cookie is sent).
 * No trailing slash: Next.js redirects "/api/socket.io/" to "/api/socket.io".
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/api/socket.io', addTrailingSlash: false, withCredentials: true, reconnectionDelayMax: 4000 });
  }
  return socket;
}

/** Drop the connection (logout / role switch) so the next one authenticates again. */
export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
