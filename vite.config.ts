import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";

const address = { host: "127.0.0.1", port: 5174, strictPort: true };

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "BFF_"), ...process.env };
  const proxy = {
    "/api/auth": { target: env.BFF_URL || "http://127.0.0.1:3001", changeOrigin: true },
  };
  return { plugins: [solid()], server: { ...address, proxy }, preview: { ...address, proxy } };
});
