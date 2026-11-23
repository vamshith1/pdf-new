import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exported as static HTML and served by the Spring Boot app (one service, free hosting).
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
