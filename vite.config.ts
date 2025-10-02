import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    dts({ 
      tsconfigPath: './tsconfig.app.json',
      rollupTypes: true,
      insertTypesEntry: true
    }),
    vue()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    cssCodeSplit: false,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Rdf4jVueComponents',
      // the proper extensions will be added
      fileName: 'rdf4j-vue-components',
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['vue', 'primevue', 'primeicons', '@primevue/themes', 'n3', 'prismjs','sparqljs', 'vue-prism-editor'],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          vue: 'Vue',
          primevue: 'PrimeVue',
          primeicons: 'PrimeIcons',
          '@primevue/themes': 'PrimeVueThemes',
          n3: 'N3',
          prismjs: 'Prism',
          sparqljs: 'SparqlJS',
          'vue-prism-editor': 'VuePrismEditor',
        },
      },
    },
  }
})
