import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" solo para la imagen Docker de producción; Vercel usa su propio empaquetado.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
