import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Action-requests zijn standaard beperkt tot 1 MB — ruim onder de
  // 4 MB (profielfoto) en 8 MB (incentive-poster) die de app zelf toestaat,
  // waardoor een normale foto-upload al mislukte nog vóór onze eigen
  // grootte-check ooit liep. Met marge voor multipart-overhead ingesteld op
  // de grootste upload (poster) + ruimte.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    resolveAlias: {
      // Zie src/lib/browserFetchShim.ts: @vercel/blob (Bibliotheek-upload)
      // heeft anders een kapotte browser-fetch onder Turbopack.
      undici: { browser: "./src/lib/browserFetchShim.ts" },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
