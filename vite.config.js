import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'fs';

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
          // Clean up empty extension/popup folder
          try {
            const emptyDir = resolve(distDir, 'extension');
            if (readdirSync(emptyDir).length === 0) {
              require('fs').rmdirSync(emptyDir);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        // Copy manifest.json
        const manifestSrc = resolve(__dirname, 'extension/manifest.json');
        const manifestDest = resolve(distDir, 'manifest.json');
        if (existsSync(manifestSrc)) {
          copyFileSync(manifestSrc, manifestDest);
        }

        // Copy icons
        const iconsSrc = resolve(__dirname, 'extension/icons');
        const iconsDest = resolve(distDir, 'icons');
        if (existsSync(iconsSrc)) {
          mkdirSync(iconsDest, { recursive: true });
          const iconFiles = readdirSync(iconsSrc).filter(f => f.endsWith('.png'));
          iconFiles.forEach(file => {
            copyFileSync(resolve(iconsSrc, file), resolve(iconsDest, file));
          });
        }

        // Copy popup CSS (if not already copied by Vite)
        const popupCssSrc = resolve(__dirname, 'extension/popup/popup.css');
        const popupCssDest = resolve(distDir, 'popup/popup.css');
        if (existsSync(popupCssSrc) && !existsSync(popupCssDest)) {
          mkdirSync(resolve(distDir, 'popup'), { recursive: true });
          copyFileSync(popupCssSrc, popupCssDest);
        }

        // Copy popup JS (if not already copied by Vite)
        const popupJsSrc = resolve(__dirname, 'extension/popup/popup.js');
        const popupJsDest = resolve(distDir, 'popup/popup.js');
        if (existsSync(popupJsSrc) && !existsSync(popupJsDest)) {
          copyFileSync(popupJsSrc, popupJsDest);
        }
      },
    },
  ],
});

