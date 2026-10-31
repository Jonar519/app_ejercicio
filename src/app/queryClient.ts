import { QueryClient } from '@tanstack/react-query';

const MAX_RETRIES = 2;

const isClientError = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_RETRIES,
    },
  },
});
