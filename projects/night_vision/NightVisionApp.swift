import SwiftUI
import AppKit
import ScreenCaptureKit

@main
struct NightVisionApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var screenMonitor = ScreenAnalyzer.shared
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        OverlayManager.shared.setupPanels()
        screenMonitor.startWatching()
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Ensure overlays are removed before the app exits
        OverlayManager.shared.emergencyRemoveAllOverlays()
    }
    
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "eye.slash.fill", accessibilityDescription: "Night Vision")
        }
        
        constructMenu()
    }
    
    func constructMenu() {
        let menu = NSMenu()
        
        // Real-time Luma Meter (Visual Debug)
        let lumaItem = NSMenuItem(title: "Current Luma: --", action: nil, keyEquivalent: "")
        lumaItem.tag = 100
        menu.addItem(lumaItem)
        menu.addItem(NSMenuItem.separator())
        
        menu.addItem(NSMenuItem(title: "Night Vision: Active", action: #selector(toggleActive(_:)), keyEquivalent: "n"))
        menu.addItem(NSMenuItem(title: "Re-Request Permission", action: #selector(checkPermissions), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        
        // Target Brightness Targets
        let maxItem = NSMenuItem(title: "Max Brightness: \(Int(screenMonitor.tgt_M * 100))%", action: #selector(setMaxBrightness), keyEquivalent: "")
        maxItem.tag = 201
        menu.addItem(maxItem)
        
        let minItem = NSMenuItem(title: "Min Brightness: \(Int(screenMonitor.tgt_m * 100))%", action: #selector(setMinBrightness), keyEquivalent: "")
        minItem.tag = 202
        menu.addItem(minItem)
        
        // Smoothing Depth — shows current value and opens input dialog
        let smoothItem = NSMenuItem(title: "Smoothing Depth: \(screenMonitor.smoothingDepth) frames", action: #selector(setSmoothingDepth), keyEquivalent: "")
        smoothItem.tag = 200
        menu.addItem(smoothItem)
        menu.addItem(NSMenuItem.separator())

        // FPS — shows current value and opens input dialog
        let fpsItem = NSMenuItem(title: "Capture FPS: \(screenMonitor.fps)", action: #selector(setCustomFPS), keyEquivalent: "")
        fpsItem.tag = 300
        menu.addItem(fpsItem)
        
        // Sensitivity Submenu
        let sensitivityMenu = NSMenu()
        sensitivityMenu.addItem(NSMenuItem(title: "Low", action: #selector(setSensitivityLow), keyEquivalent: ""))
        sensitivityMenu.addItem(NSMenuItem(title: "Medium", action: #selector(setSensitivityMedium), keyEquivalent: ""))
        sensitivityMenu.addItem(NSMenuItem(title: "High", action: #selector(setSensitivityHigh), keyEquivalent: ""))
        
        let sensitivityItem = NSMenuItem(title: "Sensitivity", action: nil, keyEquivalent: "")
        sensitivityItem.submenu = sensitivityMenu
        menu.addItem(sensitivityItem)
        
        menu.addItem(NSMenuItem.separator())
        
        let emergencyHint = NSMenuItem(title: "Emergency Quit: ⌃⌥Q (global)", action: nil, keyEquivalent: "")
        emergencyHint.isEnabled = false
        menu.addItem(emergencyHint)
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        
        statusItem?.menu = menu
        
        Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in
            if let item = menu.item(withTag: 100) {
                let luma = ScreenAnalyzer.shared.currentLuma
                item.title = String(format: "Avg Luma: %.2f (Min: %.2f, Max: %.2f)", 
                    ScreenAnalyzer.shared.currentLuma, 
                    ScreenAnalyzer.shared.currentMinLuma, 
                    ScreenAnalyzer.shared.currentMaxLuma)
            }
            if let item = menu.item(withTag: 201) {
                item.title = "Max Brightness: \(Int(ScreenAnalyzer.shared.tgt_M * 100))%"
            }
            if let item = menu.item(withTag: 202) {
                item.title = "Min Brightness: \(Int(ScreenAnalyzer.shared.tgt_m * 100))%"
            }
            if let item = menu.item(withTag: 200) {
                item.title = "Smoothing Depth: \(ScreenAnalyzer.shared.smoothingDepth) frames"
            }
            if let item = menu.item(withTag: 300) {
                item.title = "Capture FPS: \(ScreenAnalyzer.shared.fps)"
            }
        }
    }
    
    @objc func toggleActive(_ sender: NSMenuItem) {
        screenMonitor.isEnabled.toggle()
        sender.title = screenMonitor.isEnabled ? "Night Vision: Active" : "Night Vision: Paused"
    }
    
    @objc func setMaxBrightness() {
        let value = promptForNumber(title: "Max Brightness", message: "Enter target max brightness (1-100):", current: Int(screenMonitor.tgt_M * 100))
        if let v = value, v >= 1 && v <= 100 {
            screenMonitor.tgt_M = Double(v) / 100.0
        }
    }
    
    @objc func setMinBrightness() {
        let value = promptForNumber(title: "Min Brightness", message: "Enter target min brightness (0-100):", current: Int(screenMonitor.tgt_m * 100))
        if let v = value, v >= 0 && v <= 100 {
            screenMonitor.tgt_m = Double(v) / 100.0
        }
    }
    
    @objc func setSmoothingDepth() {
        let value = promptForNumber(title: "Smoothing Depth", message: "Enter number of frames to average (1-500):", current: screenMonitor.smoothingDepth)
        if let v = value, v >= 1 && v <= 500 {
            screenMonitor.smoothingDepth = v
        }
    }
    
    @objc func setCustomFPS() {
        let value = promptForNumber(title: "Capture FPS", message: "Enter desired capture FPS (1-240):", current: screenMonitor.fps)
        if let v = value, v >= 1 && v <= 240 {
            screenMonitor.fps = v
        }
    }
    
    private func promptForNumber(title: String, message: String, current: Int) -> Int? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 200, height: 24))
        input.stringValue = "\(current)"
        alert.accessoryView = input
        
        let response = alert.runModal()
        if response == .alertFirstButtonReturn {
            return Int(input.stringValue)
        }
        return nil
    }
    
    @objc func setSensitivityLow() { screenMonitor.sensitivity = 0.5 }
    @objc func setSensitivityMedium() { screenMonitor.sensitivity = 0.3 }
    @objc func setSensitivityHigh() { screenMonitor.sensitivity = 0.1 }
    
    @objc func checkPermissions() {
        // Just open System Settings directly — no probing SCShareableContent
        // which causes macOS to re-prompt on every build
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
            NSWorkspace.shared.open(url)
        }
    }
}
