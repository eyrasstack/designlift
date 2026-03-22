#!/bin/bash
# Build DesignLift Chrome Extension
set -e

echo "Building DesignLift..."

# Clean dist
rm -rf dist
mkdir -p dist/popup dist/content dist/background dist/output dist/icons

# Generate icons if missing
if [ ! -f icons/icon-16.png ]; then
  echo "Generating icons..."
  node generate-icons.js
fi

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsc

# Copy static assets
cp manifest.json dist/
cp popup/popup.html dist/popup/
cp popup/popup.css dist/popup/
cp icons/*.png dist/icons/

echo ""
echo "Build complete!"
echo "Load dist/ as an unpacked extension in Chrome:"
echo "  1. Go to chrome://extensions"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked'"
echo "  4. Select the dist/ folder"
