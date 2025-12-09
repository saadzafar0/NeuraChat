import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// Load backend env so AGORA_APP_ID/AGORA_APP_CERTIFICATE are available at build time
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") }); // local frontend env override if present
dotenv.config({ path: path.resolve(__dirname, ".env.local") }); // local overrides

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_AGORA_APP_ID: process.env.AGORA_APP_ID,
  },
};

export default nextConfig;
