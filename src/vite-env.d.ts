/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
