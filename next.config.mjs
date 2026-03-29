/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['chromadb', '@chroma-core/default-embed', '@chroma-core/ai-embeddings-common'],
};

export default nextConfig;