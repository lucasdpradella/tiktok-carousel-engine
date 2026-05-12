/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // só temos APIs; nada de imagens de Next aqui
  images: { unoptimized: true },
};
module.exports = nextConfig;
