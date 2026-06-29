/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin (e.g. https://yourdomain.com). The /api path is built in. */
  readonly VITE_API_URL: string
  /** "1"/"true" → API is on the same origin; calls go to relative /api/... */
  readonly VITE_SAME_ORIGIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
