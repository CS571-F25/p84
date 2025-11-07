import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from "@cloudflare/vite-plugin"
import metadata from './public/client-metadata.json' with { type: 'json' }

const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 3000

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    {
      name: 'oauth-env-plugin',
      config(_conf, { command }) {
        if (command === 'build') {
          process.env.VITE_OAUTH_CLIENT_ID = metadata.client_id
          process.env.VITE_OAUTH_REDIRECT_URI = metadata.redirect_uris[0]
        } else {
          const redirectUri = (() => {
            const url = new URL(metadata.redirect_uris[0])
            return `http://${SERVER_HOST}:${SERVER_PORT}${url.pathname}`
          })()

          const clientId =
            `http://localhost` +
            `?redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(metadata.scope)}`

          process.env.VITE_DEV_SERVER_PORT = '' + SERVER_PORT
          process.env.VITE_OAUTH_CLIENT_ID = clientId
          process.env.VITE_OAUTH_REDIRECT_URI = redirectUri
        }

        process.env.VITE_CLIENT_URI = metadata.client_uri
        process.env.VITE_OAUTH_SCOPE = metadata.scope
      },
    },
  ],
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
    watch: {
      // Exclude large data files from watching
      ignored: ['**/public/data/**', '**/public/symbols/**', '**/.cache/**', '.direnv/**'],
    },
  },
})

export default config
