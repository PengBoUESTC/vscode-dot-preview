import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

// @ts-expect-error
import clear from 'rollup-plugin-clear'

export default defineConfig({
  input: ['src/index.ts'],
  external: ['vscode'],
  output: {
    dir: 'dist',
    format: 'cjs',
    chunkFileNames: '[name].js',
  },

  plugins: [
    json(),
    commonjs(),
    nodeResolve(),
    clear({ targets: ['dist'] }),
    typescript({
      tsconfig: 'tsconfig.json',
    }),
  ],
})
