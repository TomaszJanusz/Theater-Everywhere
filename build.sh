#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Building Theater Everywhere Extension ==="

# Clean and recreate build directories
rm -rf dist
mkdir -p dist/chrome
mkdir -p dist/firefox

echo "Copying files to build targets..."
# Define list of files/folders to copy
FILES_TO_COPY=("manifest.json" "content.js" "content.css" "icons" "popup" "options")

for item in "${FILES_TO_COPY[@]}"; do
  cp -R "$item" dist/chrome/
  cp -R "$item" dist/firefox/
done

# Modify manifest.json for Firefox to add browser_specific_settings
echo "Injecting Firefox specific manifest settings..."
node -e '
  const fs = require("fs");
  const filePath = "dist/firefox/manifest.json";
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  manifest.browser_specific_settings = {
    gecko: {
      id: "theater-everywhere@tomaszjanusz.com",
      strict_min_version: "109.0"
    }
  };
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf8");
'

# Create Chrome package
echo "Packaging Chrome extension..."
cd dist/chrome
zip -q -r ../theater-everywhere-chrome.zip .
cd ../..

# Create Firefox package
echo "Packaging Firefox extension..."
cd dist/firefox
zip -q -r ../theater-everywhere-firefox.zip .
cd ../..

# Clean up temp folders
rm -rf dist/chrome
rm -rf dist/firefox

echo "=== Build Completed Successfully! ==="
echo "Artifacts created in dist/:"
echo "  - dist/theater-everywhere-chrome.zip"
echo "  - dist/theater-everywhere-firefox.zip"
