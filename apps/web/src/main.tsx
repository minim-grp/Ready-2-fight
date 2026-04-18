import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initAuth, useAuthStore } from "./stores/auth";
import { startOfflineFlushWatcher } from "./lib/offlineQueue";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

async function bootstrap() {
  await initAuth();
  startOfflineFlushWatcher(queryClient, () => useAuthStore.getState().user?.id ?? null);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster position="top-center" theme="dark" richColors closeButton />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
