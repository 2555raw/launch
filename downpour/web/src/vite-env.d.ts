/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_MODE?: string;
  readonly VITE_DEFAULT_CHAIN?: string;
  readonly VITE_ALLOW_LOCAL?: string;
}

interface Window {
  ethereum?: import('./wallet/types').Eip1193Provider;
}
