/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};
export default nextConfig;