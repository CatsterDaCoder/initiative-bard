import { defineConfig } from "vite";

export default defineConfig({
  base: "/initiative-bard/",
  build: {
    target: "esnext",
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
