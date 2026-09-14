import Foundation
import VideoToolbox
import ScreenCaptureKit

class ScreenAnalyzer: NSObject, SCStreamOutput, SCStreamDelegate {
    static let shared = ScreenAnalyzer()
    
    private var stream: SCStream?
    private var lastLuminance: Double = 0.5
    
    // New Normalization Targets
    var tgt_m: Double = 0.20 // 20%
    var tgt_M: Double = 0.50 // 50%
    
    // Configurable thresholds
    var sensitivity: Double = 0.2
    var fps: Int = 60 {
        didSet { if isEnabled { restartCapture() } }
    }
    
    // Smoothing configuration
    var smoothingDepth: Int = 10
    
    // Rolling Buffers — guarded by a lock to prevent race conditions
    private let bufferLock = NSLock()
    private var avgLumaBuffer: [Double] = []
    private var minLumaBuffer: [Double] = []
    private var maxLumaBuffer: [Double] = []
    
    @Published var currentLuma: Double = 0.5
    @Published var currentMinLuma: Double = 0.0
    @Published var currentMaxLuma: Double = 1.0
    
    var isEnabled: Bool = true {
        didSet {
            if isEnabled { restartCapture() } else { stopWatching() }
        }
    }
    
    override init() {
        super.init()
    }
    
    private var hasRequestedAccess = false
    
    private func restartCapture() {
        Task {
            if let existingStream = stream {
                try? await existingStream.stopCapture()
                stream = nil
            }
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
            await monitorScreen()
        }
    }
    
    func monitorScreen() async {
        // Check permission SILENTLY — no system dialog
        let hasPermission = CGPreflightScreenCaptureAccess()
        
        if !hasPermission {
            if !hasRequestedAccess {
                // Request once — this shows the macOS dialog ONE time only
                hasRequestedAccess = true
                let granted = CGRequestScreenCaptureAccess()
                NSLog("[NightVision] Permission requested, granted: \(granted)")
                if !granted {
                    NSLog("[NightVision] Waiting for user to grant permission in System Settings...")
                }
            }
            
            // Poll silently every 3 seconds until permission is granted
            NSLog("[NightVision] No permission yet. Retrying silently in 3s...")
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if isEnabled {
                await monitorScreen()
            }
            return
        }
        
        NSLog("[NightVision] Permission confirmed. Starting capture at \(fps) FPS")
        
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else {
                NSLog("[NightVision] No displays found")
                return
            }
            
            // Exclude our own app's overlay windows from capture to prevent a
            // feedback loop where the overlay darkens the captured image, which
            // makes us darken even more → converging to total blackness.
            let selfApp = content.applications.first(where: { $0.bundleIdentifier == "com.nightvision.app" })
            let excludedApps = selfApp.map { [$0] } ?? []
            let filter = SCContentFilter(display: display, excludingApplications: excludedApps, exceptingWindows: [])
            let config = SCStreamConfiguration()
            
            // Match actual display aspect ratio to avoid SCStream adding black bars (pillarbox/letterbox)
            let displayRatio = Double(display.width) / Double(display.height)
            let baseResolution = 160.0
            
            if display.width > display.height {
                config.width = Int(baseResolution)
                config.height = Int(baseResolution / displayRatio)
            } else {
                config.height = Int(baseResolution)
                config.width = Int(baseResolution * displayRatio)
            }
            
            config.minimumFrameInterval = CMTime(value: 1, timescale: Int32(fps))
            config.queueDepth = 5
            config.pixelFormat = kCVPixelFormatType_32BGRA
            
            bufferLock.withLock {
                avgLumaBuffer = []
                minLumaBuffer = []
                maxLumaBuffer = []
            }
            
            let newStream = SCStream(filter: filter, configuration: config, delegate: self)
            try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: .global(qos: .userInteractive))
            try await newStream.startCapture()
            stream = newStream
            NSLog("[NightVision] Capture started successfully")
        } catch {
            NSLog("[NightVision] Capture error: \(error.localizedDescription)")
            // Retry in case it's a transient error
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if isEnabled {
                await monitorScreen()
            }
        }
    }
    
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        let analysis = analyzeFrame(pixelBuffer: pixelBuffer)
        
        DispatchQueue.main.async {
            self.processAnalysis(analysis)
        }
    }
    
    struct FrameAnalysis {
        let avgLuma: Double
        let minLuma: Double
        let maxLuma: Double
    }
    
    private func analyzeFrame(pixelBuffer: CVPixelBuffer) -> FrameAnalysis {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
            return FrameAnalysis(avgLuma: 0.5, minLuma: 0.0, maxLuma: 1.0)
        }
        
        let ptr = baseAddress.assumingMemoryBound(to: UInt8.self)
        
        var globalTotal: Double = 0
        var globalCount: Double = 0
        var minLuma: Double = 1.0
        var maxLuma: Double = 0.0
        
        let step = 4
        
        for y in stride(from: 0, to: height, by: step) {
            for x in stride(from: 0, to: width, by: step) {
                let offset = y * bytesPerRow + x * 4
                let b = Double(ptr[offset])
                let g = Double(ptr[offset + 1])
                let r = Double(ptr[offset + 2])
                
                let luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
                
                if luma < minLuma { minLuma = luma }
                if luma > maxLuma { maxLuma = luma }
                
                globalTotal += luma
                globalCount += 1
            }
        }
        
        return FrameAnalysis(avgLuma: globalTotal / globalCount, minLuma: minLuma, maxLuma: maxLuma)
    }
    
    private func processAnalysis(_ analysis: FrameAnalysis) {
        bufferLock.withLock {
            avgLumaBuffer.append(analysis.avgLuma)
            if avgLumaBuffer.count > smoothingDepth { avgLumaBuffer.removeFirst() }
            
            minLumaBuffer.append(analysis.minLuma)
            if minLumaBuffer.count > smoothingDepth { minLumaBuffer.removeFirst() }
            
            maxLumaBuffer.append(analysis.maxLuma)
            if maxLumaBuffer.count > smoothingDepth { maxLumaBuffer.removeFirst() }
            
            // Fast-Attack, Slow-Release Logic
            // If the raw frame is BRIGHTER than our buffer average, bypass the buffer to react instantly!
            let avgBuffered = avgLumaBuffer.reduce(0, +) / Double(avgLumaBuffer.count)
            self.currentLuma = max(analysis.avgLuma, avgBuffered)
            
            // Similarly for max luma: snap instantly to sudden bright jumps
            let maxBuffered = maxLumaBuffer.reduce(0, +) / Double(maxLumaBuffer.count)
            self.currentMaxLuma = max(analysis.maxLuma, maxBuffered)
            
            // For min luma, we want to snap instantly if the screen gets super bright (min goes up),
            // so we use max again.
            let minBuffered = minLumaBuffer.reduce(0, +) / Double(minLumaBuffer.count)
            self.currentMinLuma = max(analysis.minLuma, minBuffered)
        }
        
        // 1. Flash Detection (Safety spike using INSTANT raw delta)
        let instantDelta = analysis.avgLuma - lastLuminance
        let threshold = 0.15 * sensitivity
        if instantDelta > threshold {
            OverlayManager.shared.triggerFlashSmoothing(opacity: 0.6, duration: 0.3)
        }
        
        // 2. Normalization Algorithm
        // 1. Ideal 'a' to span the range
        // If the screen max and min are extremely close, prevent division by zero using a small clamp
        var a = (tgt_M - tgt_m) / max(0.001, currentMaxLuma - currentMinLuma)
        
        // 2. We can never authentically expand contrast with passive software blending
        a = min(1.0, a)
        
        // 3. To hit tgt_M, we usually need an additive bias (the color of the overlay)
        var b = tgt_M - a * currentMaxLuma
        
        // 4. Clip 'b' to physical bounds [0, 1-a] AND the user's safety bound [0, tgt_m]
        // This prevents the "glowing grey filter" on pitch black screens
        b = max(0.0, min(1.0 - a, tgt_m, b))
        
        // 5. If 'b' was clipped, we must adjust 'a' to guarantee hitting tgt_M
        a = (tgt_M - b) / max(0.001, currentMaxLuma)
        
        // 6. Final safety cap on 'a'
        a = min(1.0, max(0.0, a))
        
        // Convert the affine a, b properties to the Opacity and White value for blending
        // Because Blend equation = x * (1 - opacity) + C * opacity
        // So a = 1 - opacity
        // So b = C * opacity
        let opacity = 1.0 - a
        let overlayWhiteValue = opacity > 0 ? min(1.0, max(0.0, b / opacity)) : 0.0
        
        OverlayManager.shared.updateNormalization(opacity: opacity, whiteValue: overlayWhiteValue)
        
        lastLuminance = currentLuma
    }
    
    @objc func stream(_ stream: SCStream, didStopWithError error: Error) {
        NSLog("[NightVision] Stream stopped: \(error.localizedDescription)")
    }
    
    func stopWatching() {
        Task {
            try? await stream?.stopCapture()
            stream = nil
        }
    }
    
    func startWatching() {
        restartCapture()
    }
}
