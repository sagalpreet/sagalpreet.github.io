import AppKit

// MARK: - OverlayWindowManager

/// Manages one transparent NSPanel overlay per connected display.
/// Call `setupPanels()` once at launch, then `applySettings()` whenever
/// the user changes opacity, mode, image, or zoom.
final class OverlayWindowManager {

    static let shared = OverlayWindowManager()
    private init() {}

    // MARK: - State

    private var panels: [NSPanel] = []
    private var renderers: [ImageRendererView] = []

    // Current settings — written by AppDelegate, consumed by renderers
    var image: NSImage?       { didSet { applySettings() } }
    var opacity: CGFloat = 0.5 { didSet { applySettings() } }
    var mode: DisplayMode = .fit { didSet { applySettings() } }
    var zoomFactor: CGFloat = 1.0 { didSet { applySettings() } }
    var isEnabled: Bool = false {
        didSet {
            panels.forEach { $0.alphaValue = isEnabled ? 1.0 : 0.0 }
            applySettings()
        }
    }

    // Per-screen enable flags (keyed by screen.deviceDescription hash)
    var disabledScreenIDs: Set<String> = []

    // MARK: - Setup

    func setupPanels() {
        teardownPanels()

        for screen in NSScreen.screens {
            let panel = makePanel(for: screen)
            let renderer = makeRenderer(for: screen)
            panel.contentView = renderer
            panel.alphaValue = isEnabled ? 1.0 : 0.0
            panel.orderFrontRegardless()

            panels.append(panel)
            renderers.append(renderer)
        }

        applySettings()

        // Watch for display configuration changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    // MARK: - Apply Settings

    func applySettings() {
        for (index, renderer) in renderers.enumerated() {
            let screen = NSScreen.screens[safe: index]
            let screenID = screen.map { screenKey($0) } ?? ""
            let screenDisabled = disabledScreenIDs.contains(screenID)

            renderer.image      = (isEnabled && !screenDisabled) ? image : nil
            renderer.opacity    = opacity
            renderer.mode       = mode
            renderer.zoomFactor = zoomFactor
        }
    }

    // MARK: - Teardown / Emergency Quit

    func emergencyRemoveAllOverlays() {
        teardownPanels()
    }

    private func teardownPanels() {
        panels.forEach { $0.close() }
        panels.removeAll()
        renderers.removeAll()
        NotificationCenter.default.removeObserver(self,
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    // MARK: - Display Change

    @objc private func screensChanged() {
        // Rebuild all panels to match current screen layout
        let wasEnabled = isEnabled
        isEnabled = false
        setupPanels()
        isEnabled = wasEnabled
    }

    // MARK: - Helpers

    private func makePanel(for screen: NSScreen) -> NSPanel {
        let style: NSWindow.StyleMask = [.nonactivatingPanel, .borderless]
        let panel = NSPanel(
            contentRect: screen.frame,
            styleMask: style,
            backing: .buffered,
            defer: false,
            screen: screen
        )
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelKey.screenSaverWindow.rawValue))
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.ignoresMouseEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false
        panel.setFrame(screen.frame, display: false)
        return panel
    }

    private func makeRenderer(for screen: NSScreen) -> ImageRendererView {
        let view = ImageRendererView(frame: CGRect(origin: .zero, size: screen.frame.size))
        view.autoresizingMask = [.width, .height]
        return view
    }

    func screenKey(_ screen: NSScreen) -> String {
        return screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")].map { "\($0)" } ?? UUID().uuidString
    }
}

// MARK: - Safe Array Subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
