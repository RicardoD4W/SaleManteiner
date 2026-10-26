/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_FRONT_VERSION?: string;
  readonly VITE_BACK_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
