import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist/chrome-mv3',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'extension/src/content.js'),
        background: resolve(__dirname, 'extension/src/background.js'),
        popup: resolve(__dirname, 'extension/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'extension/src'),
    },
  },
  plugins: [
    {
      name: 'copy-manifest-and-assets',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist/chrome-mv3');
        mkdirSync(distDir, { recursive: true });

        // Move popup.html from extension/popup/ to popup/
        const popupHtmlWrong = resolve(distDir, 'extension/popup/popup.html');
        const popupHtmlCorrect = resolve(distDir, 'popup/popup.html');
        if (existsSync(popupHtmlWrong)) {
          mkdirSync(resolve(distDir, 'popup'), { recursive: true });
          renameSync(popupHtmlWrong, popupHtmlCorrect);
          // Clean up leftover extension/ directory
          try {
            const extensionDir = resolve(distDir, 'extension');
            if (existsSync(extensionDir)) {
              rmSync(extensionDir, { recursive: true, force: true });
            }
          } catch (_) {}
        }

        // Copy manifest.json
        const manifestSrc = resolve(__dirname, 'extension/manifest.json');
        if (existsSync(manifestSrc)) {
          copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));
        }

        // Copy icons
        const iconsSrc = resolve(__dirname, 'extension/icons');
        if (existsSync(iconsSrc)) {
          const iconsDest = resolve(distDir, 'icons');
          mkdirSync(iconsDest, { recursive: true });
          readdirSync(iconsSrc)
            .filter(f => f.endsWith('.png'))
            .forEach(file => copyFileSync(resolve(iconsSrc, file), resolve(iconsDest, file)));
        }

        // Copy popup CSS (if not already bundled by Vite)
        const popupCssSrc = resolve(__dirname, 'extension/popup/popup.css');
        const popupCssDest = resolve(distDir, 'popup/popup.css');
        if (existsSync(popupCssSrc) && !existsSync(popupCssDest)) {
          mkdirSync(resolve(distDir, 'popup'), { recursive: true });
          copyFileSync(popupCssSrc, popupCssDest);
        }

        // Copy popup JS (if not already bundled by Vite)
        const popupJsSrc = resolve(__dirname, 'extension/popup/popup.js');
        const popupJsDest = resolve(distDir, 'popup/popup.js');
        if (existsSync(popupJsSrc) && !existsSync(popupJsDest)) {
          copyFileSync(popupJsSrc, popupJsDest);
        }
      },
    },
  ],
});
