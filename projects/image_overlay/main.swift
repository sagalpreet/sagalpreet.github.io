import AppKit

// Classic NSApplicationMain entry point for a pure-AppKit menu bar app.
// This file must be named main.swift — it's the designated entry point.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)  // Menu bar only — no Dock icon at runtime
app.run()
