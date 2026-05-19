import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
  },
  server: {
    // Allow embedding in OBR iframe
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
