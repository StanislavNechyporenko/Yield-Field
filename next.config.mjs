/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Optional pretty-printer deps referenced by WalletConnect's logger; not needed in the browser bundle.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // React-native-only storage referenced by the MetaMask SDK; stub it out for web.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
