import AppKit
import CoreGraphics

// MARK: - Display Modes

enum DisplayMode: String, CaseIterable {
    case fit        = "Fit (Letterbox)"
    case fill       = "Fill (Zoom to Cover)"
    case tile       = "Tile (1× pixel)"
    case tileZoom   = "Tile (Custom Zoom)"
    case stretch    = "Stretch"
}

// MARK: - ImageRendererView

/// A transparent NSView that draws an NSImage in the configured display mode.
/// Drop one instance into each per-screen overlay NSPanel.
final class ImageRendererView: NSView {

    // MARK: Properties (all trigger redraw on set)

    var image: NSImage? { didSet { needsDisplay = true } }

    var opacity: CGFloat = 0.5 {
        didSet { opacity = max(0, min(1, opacity)); needsDisplay = true }
    }

    var mode: DisplayMode = .fit { didSet { needsDisplay = true } }

    /// Used by .fill (extra zoom beyond cover) and .tileZoom (tile scale factor).
    var zoomFactor: CGFloat = 1.0 {
        didSet { zoomFactor = max(0.1, min(4.0, zoomFactor)); needsDisplay = true }
    }

    // MARK: Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    // MARK: Drawing

    override var isOpaque: Bool { false }

    override func draw(_ dirtyRect: NSRect) {
        guard let image = image,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
              let ctx = NSGraphicsContext.current?.cgContext
        else { return }

        let bounds = self.bounds
        let imgW = CGFloat(cgImage.width)
        let imgH = CGFloat(cgImage.height)
        guard imgW > 0, imgH > 0 else { return }

        ctx.saveGState()
        ctx.setAlpha(opacity)

        switch mode {
        case .fit:
            drawFit(ctx: ctx, cgImage: cgImage, imgW: imgW, imgH: imgH, bounds: bounds)
        case .fill:
            drawFill(ctx: ctx, cgImage: cgImage, imgW: imgW, imgH: imgH, bounds: bounds)
        case .tile:
            drawTile(ctx: ctx, cgImage: cgImage, imgW: imgW, imgH: imgH,
                     bounds: bounds, scale: 1.0)
        case .tileZoom:
            drawTile(ctx: ctx, cgImage: cgImage, imgW: imgW, imgH: imgH,
                     bounds: bounds, scale: zoomFactor)
        case .stretch:
            ctx.draw(cgImage, in: bounds)
        }

        ctx.restoreGState()
    }

    // MARK: - Mode Implementations

    private func drawFit(ctx: CGContext, cgImage: CGImage,
                         imgW: CGFloat, imgH: CGFloat, bounds: CGRect) {
        let scale = min(bounds.width / imgW, bounds.height / imgH)
        let drawW = imgW * scale
        let drawH = imgH * scale
        let rect = CGRect(
            x: bounds.midX - drawW / 2,
            y: bounds.midY - drawH / 2,
            width: drawW, height: drawH
        )
        ctx.draw(cgImage, in: rect)
    }

    private func drawFill(ctx: CGContext, cgImage: CGImage,
                          imgW: CGFloat, imgH: CGFloat, bounds: CGRect) {
        // scale to cover, then apply additional zoomFactor
        let coverScale = max(bounds.width / imgW, bounds.height / imgH) * zoomFactor
        let drawW = imgW * coverScale
        let drawH = imgH * coverScale
        let rect = CGRect(
            x: bounds.midX - drawW / 2,
            y: bounds.midY - drawH / 2,
            width: drawW, height: drawH
        )
        ctx.clip(to: bounds)
        ctx.draw(cgImage, in: rect)
    }

    private func drawTile(ctx: CGContext, cgImage: CGImage,
                          imgW: CGFloat, imgH: CGFloat,
                          bounds: CGRect, scale: CGFloat) {
        let tileW = imgW * scale
        let tileH = imgH * scale
        guard tileW > 0, tileH > 0 else { return }

        ctx.clip(to: bounds)

        // Start from top-left (in flipped CG coords, y=0 is bottom)
        var y: CGFloat = 0
        while y < bounds.maxY {
            var x: CGFloat = 0
            while x < bounds.maxX {
                let rect = CGRect(x: x, y: y, width: tileW, height: tileH)
                ctx.draw(cgImage, in: rect)
                x += tileW
            }
            y += tileH
        }
    }
}
