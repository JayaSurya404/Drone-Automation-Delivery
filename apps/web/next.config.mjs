/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiHost}/api/v1/:path*`
      }
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"]
    };
    return config;
  }
};

export default nextConfig;
