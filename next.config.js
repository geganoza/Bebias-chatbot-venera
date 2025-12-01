/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude unnecessary files from serverless function bundles
  outputFileTracingExcludes: {
    '*': [
      '.git',
      '.next/cache',
      'node_modules/.cache',
      'node_modules/**/test',
      'node_modules/**/tests',
      'node_modules/**/*.md',
      'node_modules/**/LICENSE',
      'node_modules/**/.github',
      'scripts',
      'docs',
      '**/*.map'
    ],
  },
}

module.exports = nextConfig