import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["pdfjs-dist", "docx-preview"],
};

export default nextConfig;
