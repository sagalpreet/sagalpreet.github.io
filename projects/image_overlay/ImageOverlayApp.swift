// Entry point — pure AppKit, no SwiftUI lifecycle needed for a menu bar app.
// NSApplicationMain sets up the run loop and calls AppDelegate automatically.
import AppKit
import UniformTypeIdentifiers

// MARK: - AppDelegate

final class AppDelegate: NSObject, NSApplicationDelegate {

    // MARK: Properties

    private var statusItem: NSStatusItem?
    private var settingsController: SettingsWindowController?  // must outlive the window
    private let manager = OverlayWindowManager.shared

    // Persisted defaults keys
    private enum Defaults {
        static let opacity     = "overlayOpacity"
        static let mode        = "overlayMode"
        static let zoomFactor  = "overlayZoomFactor"
        static let imagePath   = "overlayImagePath"
        static let enabled     = "overlayEnabled"
    }

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        loadDefaults()
        setupStatusItem()
        manager.setupPanels()
    }

    func applicationWillTerminate(_ notification: Notification) {
        manager.emergencyRemoveAllOverlays()
    }

    // MARK: - Defaults

    private func loadDefaults() {
        let ud = UserDefaults.standard

        // Opacity (default 50%)
        let storedOpacity = ud.object(forKey: Defaults.opacity) != nil
            ? CGFloat(ud.double(forKey: Defaults.opacity))
            : 0.5
        manager.opacity = storedOpacity

        // Mode
        if let rawMode = ud.string(forKey: Defaults.mode),
           let mode = DisplayMode(rawValue: rawMode) {
            manager.mode = mode
        }

        // Zoom Factor
        let storedZoom = ud.object(forKey: Defaults.zoomFactor) != nil
            ? CGFloat(ud.double(forKey: Defaults.zoomFactor))
            : 1.0
        manager.zoomFactor = storedZoom

        // Last image
        var imageLoaded = false
        if let path = ud.string(forKey: Defaults.imagePath),
           let img = NSImage(contentsOfFile: path) {
            manager.image = img
            imageLoaded = true
        }

        if !imageLoaded {
            if let defaultPath = Bundle.main.path(forResource: "paper_grain", ofType: "png", inDirectory: "assets"),
               let img = NSImage(contentsOfFile: defaultPath) {
                manager.image = img
                ud.set(defaultPath, forKey: Defaults.imagePath)
            }
        }

        // Enabled state (default off)
        manager.isEnabled = ud.bool(forKey: Defaults.enabled)
    }

    private func saveDefaults() {
        let ud = UserDefaults.standard
        ud.set(Double(manager.opacity),    forKey: Defaults.opacity)
        ud.set(manager.mode.rawValue,      forKey: Defaults.mode)
        ud.set(Double(manager.zoomFactor), forKey: Defaults.zoomFactor)
        ud.set(manager.isEnabled,          forKey: Defaults.enabled)
    }

    // MARK: - Status Item

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let btn = statusItem?.button {
            btn.image = NSImage(systemSymbolName: "photo.fill.on.rectangle.fill",
                                accessibilityDescription: "Image Overlay")
            btn.image?.isTemplate = true
        }
        buildMenu()
    }

    // MARK: - Menu

    @objc private func buildMenu() {
        let menu = NSMenu()

        // Toggle enable/disable
        let toggleItem = NSMenuItem(
            title: manager.isEnabled ? "Overlay: ON" : "Overlay: OFF",
            action: #selector(toggleOverlay(_:)),
            keyEquivalent: "o"
        )
        toggleItem.tag = 1
        menu.addItem(toggleItem)

        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Open Settings…",
                                action: #selector(openSettings),
                                keyEquivalent: ","))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit",
                                action: #selector(NSApplication.terminate(_:)),
                                keyEquivalent: "q"))

        statusItem?.menu = menu
    }

    @objc private func toggleOverlay(_ sender: NSMenuItem) {
        manager.isEnabled.toggle()
        sender.title = manager.isEnabled ? "Overlay: ON" : "Overlay: OFF"
        saveDefaults()
    }

    // MARK: - Settings Panel

    @objc private func openSettings() {
        if let ctrl = settingsController, let win = ctrl.window, win.isVisible {
            NSApp.activate(ignoringOtherApps: true)
            win.makeKeyAndOrderFront(nil)
            return
        }

        // Hold a strong reference — without this the controller is released
        // immediately after openSettings() returns and all button targets go dead.
        let ctrl = SettingsWindowController(appDelegate: self)
        settingsController = ctrl
        NSApp.activate(ignoringOtherApps: true)
        ctrl.window?.makeKeyAndOrderFront(nil)
    }

    // Callback from settings panel to apply changes
    func applySettings(image: NSImage?,
                       imagePath: String?,
                       opacity: CGFloat,
                       mode: DisplayMode,
                       zoomFactor: CGFloat) {
        manager.image       = image
        manager.opacity     = opacity
        manager.mode        = mode
        manager.zoomFactor  = zoomFactor

        if let path = imagePath {
            UserDefaults.standard.set(path, forKey: Defaults.imagePath)
        }
        saveDefaults()

        // Update toggle label
        if let menu = statusItem?.menu, let item = menu.item(withTag: 1) {
            item.title = manager.isEnabled ? "Overlay: ON" : "Overlay: OFF"
        }
    }
}

// MARK: - Settings Window Controller

final class SettingsWindowController: NSWindowController {

    private weak var appDelegate: AppDelegate?
    private let manager = OverlayWindowManager.shared

    // UI elements
    private var imagePathLabel   = NSTextField(labelWithString: "No image selected")
    private var opacitySlider    = NSSlider()
    private var opacityLabel     = NSTextField(labelWithString: "50%")
    private var modePopup        = NSPopUpButton()
    private var zoomSlider       = NSSlider()
    private var zoomLabel        = NSTextField(labelWithString: "1.0×")
    private var enableToggle     = NSButton()
    private var zoomStack        = NSView()   // shown/hidden depending on mode

    private var selectedImage: NSImage?
    private var selectedImagePath: String?

    init(appDelegate: AppDelegate) {
        self.appDelegate = appDelegate

        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 480),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        win.title = "Image Overlay — Settings"
        win.center()
        win.isReleasedWhenClosed = false

        super.init(window: win)
        buildUI()
        loadCurrentValues()
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    // MARK: - UI Layout

    private func buildUI() {
        guard let contentView = window?.contentView else { return }
        contentView.wantsLayer = true

        let padding: CGFloat = 24
        let w = contentView.bounds.width - padding * 2
        var y: CGFloat = contentView.bounds.height - padding

        func nextY(_ height: CGFloat, gap: CGFloat = 12) -> CGFloat {
            y -= height + gap
            return y
        }

        // ── Title ──────────────────────────────────────────────────────────

        let title = NSTextField(labelWithString: "Image Overlay")
        title.font = NSFont.systemFont(ofSize: 18, weight: .semibold)
        title.frame = NSRect(x: padding, y: nextY(26, gap: 20), width: w, height: 26)
        contentView.addSubview(title)

        // ── Image Picker ───────────────────────────────────────────────────

        let pickLabel = NSTextField(labelWithString: "IMAGE")
        pickLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        pickLabel.textColor = .secondaryLabelColor
        pickLabel.frame = NSRect(x: padding, y: nextY(14, gap: 6), width: w, height: 14)
        contentView.addSubview(pickLabel)

        let pickRow = NSView(frame: NSRect(x: padding, y: nextY(28, gap: 4), width: w, height: 28))
        imagePathLabel.frame = NSRect(x: 0, y: 4, width: w - 100, height: 20)
        imagePathLabel.lineBreakMode = .byTruncatingHead
        imagePathLabel.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        imagePathLabel.textColor = .secondaryLabelColor
        pickRow.addSubview(imagePathLabel)

        let pickBtn = NSButton(title: "Choose…", target: self, action: #selector(pickImage))
        pickBtn.frame = NSRect(x: w - 90, y: 0, width: 90, height: 28)
        pickBtn.bezelStyle = .rounded
        pickRow.addSubview(pickBtn)
        contentView.addSubview(pickRow)

        // ── Opacity Slider ─────────────────────────────────────────────────

        let opLabel = NSTextField(labelWithString: "OPACITY")
        opLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        opLabel.textColor = .secondaryLabelColor
        opLabel.frame = NSRect(x: padding, y: nextY(14, gap: 14), width: w, height: 14)
        contentView.addSubview(opLabel)

        let opRow = NSView(frame: NSRect(x: padding, y: nextY(22, gap: 4), width: w, height: 22))
        opacitySlider.frame = NSRect(x: 0, y: 0, width: w - 52, height: 22)
        opacitySlider.minValue  = 0
        opacitySlider.maxValue  = 100
        opacitySlider.intValue  = 50
        opacitySlider.target    = self
        opacitySlider.action    = #selector(opacityChanged)
        opRow.addSubview(opacitySlider)

        opacityLabel.frame = NSRect(x: w - 48, y: 2, width: 48, height: 18)
        opacityLabel.alignment = .right
        opRow.addSubview(opacityLabel)
        contentView.addSubview(opRow)

        // ── Display Mode ───────────────────────────────────────────────────

        let modeLabel = NSTextField(labelWithString: "DISPLAY MODE")
        modeLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        modeLabel.textColor = .secondaryLabelColor
        modeLabel.frame = NSRect(x: padding, y: nextY(14, gap: 14), width: w, height: 14)
        contentView.addSubview(modeLabel)

        modePopup.frame = NSRect(x: padding, y: nextY(26, gap: 4), width: w, height: 26)
        for mode in DisplayMode.allCases {
            modePopup.addItem(withTitle: mode.rawValue)
        }
        modePopup.target = self
        modePopup.action = #selector(modeChanged)
        contentView.addSubview(modePopup)

        // ── Zoom Slider ────────────────────────────────────────────────────

        let zoomLabelHeader = NSTextField(labelWithString: "ZOOM FACTOR")
        zoomLabelHeader.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        zoomLabelHeader.textColor = .secondaryLabelColor
        zoomLabelHeader.frame = NSRect(x: padding, y: nextY(14, gap: 14), width: w, height: 14)

        let zoomRow = NSView(frame: NSRect(x: padding, y: nextY(22, gap: 4), width: w, height: 22))
        zoomSlider.frame = NSRect(x: 0, y: 0, width: w - 52, height: 22)
        zoomSlider.minValue    = 10
        zoomSlider.maxValue    = 400
        zoomSlider.intValue    = 100
        zoomSlider.target      = self
        zoomSlider.action      = #selector(zoomChanged)
        zoomRow.addSubview(zoomSlider)

        zoomLabel.frame = NSRect(x: w - 48, y: 2, width: 48, height: 18)
        zoomLabel.alignment = .right
        zoomRow.addSubview(zoomLabel)

        // Group zoom elements into a view we can show/hide
        zoomStack = NSView(frame: NSRect(x: 0, y: zoomRow.frame.minY - 2,
                                         width: contentView.bounds.width,
                                         height: zoomLabelHeader.frame.height + zoomRow.frame.height + 16))

        // Translate to zoomStack-local coords
        let localHeaderY = zoomRow.frame.height + 4
        let localRowY: CGFloat = 0
        let headerInStack = NSTextField(labelWithString: "ZOOM FACTOR")
        headerInStack.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        headerInStack.textColor = .secondaryLabelColor
        headerInStack.frame = NSRect(x: padding, y: localHeaderY + 2, width: w, height: 14)
        zoomStack.addSubview(headerInStack)
        zoomSlider.frame = NSRect(x: padding, y: localRowY, width: w - 52, height: 22)
        zoomLabel.frame  = NSRect(x: padding + w - 48, y: localRowY + 2, width: 48, height: 18)
        zoomStack.addSubview(zoomSlider)
        zoomStack.addSubview(zoomLabel)
        contentView.addSubview(zoomStack)

        // ── Enable Toggle ──────────────────────────────────────────────────

        enableToggle = NSButton(checkboxWithTitle: "Enable Overlay",
                                target: self, action: #selector(toggleEnable))
        enableToggle.frame = NSRect(x: padding, y: padding, width: w, height: 22)
        contentView.addSubview(enableToggle)

        // ── Apply Button ───────────────────────────────────────────────────

        let applyBtn = NSButton(title: "Apply", target: self, action: #selector(applyPressed))
        applyBtn.frame = NSRect(x: contentView.bounds.width - padding - 120,
                                y: padding, width: 120, height: 28)
        applyBtn.bezelStyle = .rounded
        applyBtn.keyEquivalent = "\r"
        contentView.addSubview(applyBtn)
    }

    // MARK: - Load Current Values

    private func loadCurrentValues() {
        // Opacity
        let pct = Int(manager.opacity * 100)
        opacitySlider.intValue = Int32(pct)
        opacityLabel.stringValue = "\(pct)%"

        // Mode
        let modeIndex = DisplayMode.allCases.firstIndex(of: manager.mode) ?? 0
        modePopup.selectItem(at: modeIndex)

        // Zoom
        let zPct = Int(manager.zoomFactor * 100)
        zoomSlider.intValue = Int32(zPct)
        zoomLabel.stringValue = String(format: "%.2f×", manager.zoomFactor)

        // Image
        if let img = manager.image {
            selectedImage = img
            imagePathLabel.stringValue = UserDefaults.standard.string(forKey: "overlayImagePath") ?? "Image loaded"
        }

        // Enable
        enableToggle.state = manager.isEnabled ? .on : .off

        updateZoomVisibility()
    }

    // MARK: - Actions

    @objc private func pickImage() {
        guard let win = window else { return }

        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.png, .jpeg, .tiff, .bmp, .gif, .heic]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.title = "Choose Overlay Image"
        panel.prompt = "Use Image"

        // Show as a sheet attached to the settings window.
        // This is the only reliable approach in .accessory activation-policy apps
        // because the sheet inherits the parent window's key-window status.
        NSApp.activate(ignoringOtherApps: true)
        win.makeKeyAndOrderFront(nil)

        panel.beginSheetModal(for: win) { [weak self] response in
            guard let self, response == .OK, let url = panel.url else { return }
            self.selectedImagePath = url.path
            self.selectedImage = NSImage(contentsOf: url)
            self.imagePathLabel.stringValue = url.lastPathComponent
        }
    }

    @objc private func opacityChanged() {
        let pct = opacitySlider.intValue
        opacityLabel.stringValue = "\(pct)%"
        // Live preview
        manager.opacity = CGFloat(pct) / 100.0
    }

    @objc private func modeChanged() {
        updateZoomVisibility()
        // Live preview
        let index = modePopup.indexOfSelectedItem
        if let mode = DisplayMode.allCases[safe: index] {
            manager.mode = mode
        }
    }

    @objc private func zoomChanged() {
        let pct = zoomSlider.intValue
        let factor = CGFloat(pct) / 100.0
        zoomLabel.stringValue = String(format: "%.2f×", factor)
        // Live preview
        manager.zoomFactor = factor
    }

    @objc private func toggleEnable() {
        manager.isEnabled = enableToggle.state == .on
        appDelegate?.applySettings(
            image: selectedImage,
            imagePath: selectedImagePath,
            opacity: CGFloat(opacitySlider.intValue) / 100.0,
            mode: DisplayMode.allCases[safe: modePopup.indexOfSelectedItem] ?? .fit,
            zoomFactor: CGFloat(zoomSlider.intValue) / 100.0
        )
    }

    @objc private func applyPressed() {
        appDelegate?.applySettings(
            image: selectedImage,
            imagePath: selectedImagePath,
            opacity: CGFloat(opacitySlider.intValue) / 100.0,
            mode: DisplayMode.allCases[safe: modePopup.indexOfSelectedItem] ?? .fit,
            zoomFactor: CGFloat(zoomSlider.intValue) / 100.0
        )
    }

    private func updateZoomVisibility() {
        let index = modePopup.indexOfSelectedItem
        guard let mode = DisplayMode.allCases[safe: index] else { return }
        let showZoom = (mode == .fill || mode == .tileZoom)
        zoomStack.isHidden = !showZoom
    }
}

// MARK: - Safe Array Subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
