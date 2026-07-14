"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Default is 3 retries with exponential backoff — fine against a
          // healthy backend, but compounds a misrouted/unreachable backend
          // into minutes of hung UI instead of a quick, visible failure.
          queries: { retry: 1, staleTime: 30_000 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
