import Cocoa
import SwiftUI
import Carbon.HIToolbox

class DimmingPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
    
    init(contentRect: NSRect, screen: NSScreen) {
        super.init(
            contentRect: contentRect,
            styleMask: [.nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        self.level = .screenSaver
        self.backgroundColor = .clear
        self.isOpaque = false
        self.alphaValue = 1.0
        self.ignoresMouseEvents = true
        self.hidesOnDeactivate = false
        self.hasShadow = false // FIX: Prevent macOS from drawing a black shadow around the panel edges!
        self.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
    }
}

class OverlayManager: NSObject {
    static let shared = OverlayManager()
    
    private var overlayPanels: [DimmingPanel] = []
    
    // Single normalization layer
    
    // For global (non-localized) dimming, we tint this layer
    private var globalDimLayers: [CALayer] = []
    
    // Global hotkey references
    private var emergencyHotkeyRef: EventHotKeyRef?
    
    // Maximum opacity caps to prevent total blackout
    private let maxShadowAlpha: Double = 0.65
    private let maxGlobalOpacity: Float = 0.60
    
    override init() {
        super.init()
    }
    
    func setupPanels() {
        overlayPanels.forEach { $0.close() }
        overlayPanels.removeAll()
        globalDimLayers.removeAll()
        
        for screen in NSScreen.screens {
            // SAFETY: Use visibleFrame to exclude the menu bar area.
            // The menu bar must NEVER be covered by the overlay to ensure
            // the user can always access the status bar icon to control/quit the app.
            let safeFrame = screen.visibleFrame
            let panel = DimmingPanel(contentRect: safeFrame, screen: screen)
            
            // Use a level BELOW popUpMenu (101) so status bar dropdowns remain visible,
            // but above most normal/floating/modal windows.
            panel.level = NSWindow.Level(rawValue: 100)
            panel.orderFrontRegardless()
            
            // Host layer
            let hostLayer = CALayer()
            hostLayer.frame = panel.contentView?.bounds ?? .zero
            panel.contentView?.layer = hostLayer
            panel.contentView?.wantsLayer = true
            
            // To properly map the full-screen capture to the safeFrame panel, we must offset and size
            // the layer to match the full screen's proportions, but placed relative to the panel.
            let xOffset = screen.frame.minX - safeFrame.minX
            let yOffset = screen.frame.minY - safeFrame.minY
            let fullScreenFrame = CGRect(x: xOffset, y: yOffset, width: screen.frame.width, height: screen.frame.height)
            
            // Global dim layer (for base dimming + flash smoothing)
            let dimLayer = CALayer()
            dimLayer.frame = fullScreenFrame
            dimLayer.backgroundColor = NSColor(white: 0.0, alpha: 1.0).cgColor
            dimLayer.opacity = 0
            hostLayer.addSublayer(dimLayer)
            globalDimLayers.append(dimLayer)
            
            overlayPanels.append(panel)
        }
        
        // Register global emergency hotkey: Ctrl+Option+Q to kill overlays and quit
        registerEmergencyHotkey()
    }
    
    // MARK: - Emergency Global Hotkey (Ctrl+Option+Q)
    
    private func registerEmergencyHotkey() {
        // Install a global event handler for the hotkey
        var eventSpec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        
        InstallEventHandler(GetApplicationEventTarget(), { (_, event, _) -> OSStatus in
            var hotkeyID = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hotkeyID)
            
            if hotkeyID.id == 1 {
                // Emergency kill: remove all overlays and quit
                NSLog("[NightVision] Emergency hotkey pressed (Ctrl+Option+Q) — removing overlays and quitting.")
                OverlayManager.shared.emergencyRemoveAllOverlays()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    NSApplication.shared.terminate(nil)
                }
            }
            return noErr
        }, 1, &eventSpec, nil, nil)
        
        // Register Ctrl+Option+Q  (kVK_ANSI_Q = 0x0C)
        var hotkeyID = EventHotKeyID(signature: OSType(0x4E56_4B31), id: 1) // "NVK1"
        let modifiers: UInt32 = UInt32(controlKey | optionKey)
        RegisterEventHotKey(UInt32(kVK_ANSI_Q), modifiers, hotkeyID, GetApplicationEventTarget(), 0, &emergencyHotkeyRef)
        
        NSLog("[NightVision] Emergency hotkey registered: Ctrl+Option+Q to quit")
    }
    
    /// Immediately removes all overlay panels — used for emergency exit
    func emergencyRemoveAllOverlays() {
        for layer in globalDimLayers {
            layer.opacity = 0
        }
        for panel in overlayPanels {
            panel.orderOut(nil)
            panel.close()
        }
        overlayPanels.removeAll()
        globalDimLayers.removeAll()
    }
    
    /// Normalization update
    func updateNormalization(opacity: Double, whiteValue: Double) {
        DispatchQueue.main.async {
            let clampedOpacity = Float(min(1.0, max(0, opacity)))
            let clampedWhite = CGFloat(min(1.0, max(0, whiteValue)))
            
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            
            for layer in self.globalDimLayers {
                layer.backgroundColor = NSColor(white: clampedWhite, alpha: 1.0).cgColor
                layer.opacity = clampedOpacity
            }
            
            CATransaction.commit()
        }
    }
    
    /// Flash smoothing: brief spike of dimming
    func triggerFlashSmoothing(opacity: CGFloat, duration: TimeInterval) {
        let targetOpacity = Float(min(CGFloat(maxGlobalOpacity), opacity))
        DispatchQueue.main.async {
            for layer in self.globalDimLayers {
                // Rapid onset
                CATransaction.begin()
                CATransaction.setAnimationDuration(0.03)
                layer.opacity = targetOpacity
                CATransaction.commit()
                
                // Slow decay
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    CATransaction.begin()
                    CATransaction.setAnimationDuration(duration)
                    layer.opacity = 0
                    CATransaction.commit()
                }
            }
        }
    }
    
    
    // Fallback stub for ScreenAnalyzer if needed, although we removed the callers
    func clearShadowGrid() {}
}
