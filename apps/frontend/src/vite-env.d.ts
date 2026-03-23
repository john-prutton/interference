/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL for the backend (e.g. "wss://api.example.com/ws"). Falls back to current host. */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
