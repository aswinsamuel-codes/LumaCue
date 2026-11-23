import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactCompiler: false,
  // A self-contained server in .next/standalone with only the files it needs at runtime.
  // The desktop app and the Docker image ship this instead of the full node_modules.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
