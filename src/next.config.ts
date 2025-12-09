import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1764610046399.cluster-ar5ykyjhlfetmwxm2nmwbrjbvm.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
