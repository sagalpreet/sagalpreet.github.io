#!/bin/bash
set -e

# Simple script to build the Night Vision macOS app

APP_NAME="Night Vision"
EXECUTABLE_NAME="NightVision"
BUNDLE_ID="com.nightvision.app"
SWIFT_FILES="NightVisionApp.swift OverlayManager.swift ScreenAnalyzer.swift"

echo "Building $APP_NAME..."

# Kill any running instance
pkill -f "Night Vision" 2>/dev/null || true

# Create app bundle structure
mkdir -p "$APP_NAME.app/Contents/MacOS"

# Compile Swift files
swiftc -O -o "$APP_NAME.app/Contents/MacOS/$EXECUTABLE_NAME" \
    -sdk $(xcrun --show-sdk-path --sdk macosx) \
    -target arm64-apple-macos14.0 \
    -framework Cocoa -framework SwiftUI -framework ScreenCaptureKit -framework VideoToolbox -framework CoreMedia -framework CoreGraphics \
    $SWIFT_FILES

# Copy Info.plist
cp Info.plist "$APP_NAME.app/Contents/Info.plist"

# Copy Resources (App Icon)
mkdir -p "$APP_NAME.app/Contents/Resources"
if [ -f "NightVision.icns" ]; then
    cp NightVision.icns "$APP_NAME.app/Contents/Resources/"
fi

# Ad-hoc sign the app with entitlements
echo "Signing app with entitlements..."
codesign -s - --force --deep --entitlements "NightVision.entitlements" "$APP_NAME.app"

# Reset TCC permissions for this bundle ID so new signature is accepted
echo "Resetting screen capture permissions for fresh signature..."
tccutil reset ScreenCapture "$BUNDLE_ID" 2>/dev/null || true

# Create DMG with Applications shortcut
echo "Creating DMG..."
rm -f NightVision.dmg
mkdir -p dmg_stage
cp -R "$APP_NAME.app" dmg_stage/
ln -s /Applications dmg_stage/Applications
hdiutil create -volname "$APP_NAME" -srcfolder dmg_stage -ov -format UDZO NightVision.dmg
rm -rf dmg_stage

echo "Successfully built $APP_NAME.app and packaged into NightVision.dmg"
echo "Copy to /Applications and launch. Grant Screen Recording permission when prompted."
