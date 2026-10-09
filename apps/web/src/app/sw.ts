/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache the realtime socket or recorded audio (large, private, Range requests) — also keeps defaultCache off them.
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/socket.io') || /^\/api\/recordings\/[^/]+\/audio$/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    // API: always try the network first (fresh data), fall back to the last response offline.
    {
      matcher: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET' && !url.pathname.startsWith('/api/auth'),
      handler: new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 8 }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
