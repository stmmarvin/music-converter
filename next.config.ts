import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static', 'youtube-dl-exec'],
};

export default nextConfig;
