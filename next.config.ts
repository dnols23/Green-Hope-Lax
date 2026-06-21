import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow Supabase Storage public URLs (player/coach photos, news images).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
