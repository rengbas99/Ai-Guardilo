#!/bin/bash
# Quick test script for AI Guardrail extension

echo "🔨 Building extension..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📦 Extension ready at:"
    echo "   $(pwd)/dist/chrome-mv3"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Open chrome://extensions/"
    echo "   2. Enable 'Developer mode'"
    echo "   3. Click 'Load unpacked'"
    echo "   4. Select the dist/chrome-mv3 folder above"
    echo ""
    echo "🧪 Test on: https://chat.openai.com"
    echo "   Paste: Patient John Doe, SW1A 1AA, email: john@test.com"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi
