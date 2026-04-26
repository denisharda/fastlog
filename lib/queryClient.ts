// lib/queryClient.ts
// Single QueryClient shared by the React provider in app/_layout.tsx
// and by Realtime handlers in lib/realtime.ts that need to invalidate
// caches on remote changes.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});
