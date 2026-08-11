/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.ts'],
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/scripts/**/*.js', 'src/features/**/*.js', 'src/i18n/**/*.{js,ts}']
    }
  }
})