import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./cases/*.json"] },
};

export default config;
