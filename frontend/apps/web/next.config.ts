import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API is the only backend; all data flows through server components/actions.
  outputFileTracingRoot: "../../../",
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
