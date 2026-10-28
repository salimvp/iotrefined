import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The repo may contain other lockfiles above this app; pin the root here.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
