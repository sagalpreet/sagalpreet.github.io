#!/bin/bash
set -e

# Build script for Image Overlay macOS app
# Requires: Xcode Command Line Tools (swiftc)

APP_NAME="Image Overlay"
EXECUTABLE_NAME="ImageOverlay"
BUNDLE_ID="com.imageoverlay.app"
SWIFT_FILES="main.swift ImageOverlayApp.swift OverlayWindowManager.swift ImageRenderer.swift"

echo "🖼  Building $APP_NAME..."

# Kill any running instance
pkill -f "Image Overlay" 2>/dev/null || true

# Create app bundle structure
mkdir -p "$APP_NAME.app/Contents/MacOS"
mkdir -p "$APP_NAME.app/Contents/Resources"

# Compile Swift files
echo "  Compiling Swift sources..."
swiftc -O -o "$APP_NAME.app/Contents/MacOS/$EXECUTABLE_NAME" \
    -sdk $(xcrun --show-sdk-path --sdk macosx) \
    -target arm64-apple-macos13.0 \
    -framework Cocoa \
    -framework SwiftUI \
    -framework CoreGraphics \
    -framework UniformTypeIdentifiers \
    $SWIFT_FILES

# Copy Info.plist
cp Info.plist "$APP_NAME.app/Contents/Info.plist"

# Copy icon if present
if [ -f "ImageOverlay.icns" ]; then
    cp ImageOverlay.icns "$APP_NAME.app/Contents/Resources/"
fi

# Copy default assets
mkdir -p "$APP_NAME.app/Contents/Resources/assets"
if [ -f "assets/paper_grain.png" ]; then
    cp assets/paper_grain.png "$APP_NAME.app/Contents/Resources/assets/"
fi

# Ad-hoc sign with entitlements
echo "  Signing..."
codesign -s - --force --deep \
    --entitlements "ImageOverlay.entitlements" \
    "$APP_NAME.app"

echo "✅ Built $APP_NAME.app successfully!"
echo ""
echo "To run:"
echo "  open \"$APP_NAME.app\""
echo ""

# Create DMG
echo "📦 Creating DMG..."
rm -f ImageOverlay.dmg
mkdir -p dmg_stage
cp -R "$APP_NAME.app" dmg_stage/
ln -s /Applications dmg_stage/Applications
hdiutil create -volname "$APP_NAME" \
    -srcfolder dmg_stage \
    -ov -format UDZO \
    ImageOverlay.dmg
rm -rf dmg_stage
echo "✅ ImageOverlay.dmg created"
