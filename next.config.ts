import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "pdfkit", "docx", "fontkit"]
};

export default nextConfig;
