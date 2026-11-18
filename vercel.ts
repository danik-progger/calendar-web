import type { VercelConfig } from "@vercel/config/v1";

if (!process.env.BFF_URL) throw new Error("Set BFF_URL to the deployed BFF origin.");
const bff = new URL(process.env.BFF_URL);
if (
  bff.protocol !== "https:" ||
  bff.username ||
  bff.password ||
  bff.pathname !== "/" ||
  bff.search ||
  bff.hash
) {
  throw new Error("BFF_URL must be an HTTPS origin.");
}

export const config: VercelConfig = {
  framework: "vite",
  buildCommand: "bun run build",
  outputDirectory: "dist",
  rewrites: [
    { source: "/api/auth/:path*", destination: `${bff.origin}/api/auth/:path*` },
    { source: "/((?!api/|assets/).*)", destination: "/index.html" },
  ],
};
