/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Loopback Operator API origin, e.g. http://127.0.0.1:8787 — never a provider key */
  readonly VITE_OPERATOR_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
