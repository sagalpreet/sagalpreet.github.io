import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle background (Instagram gradient approximation)
    corner_radius = int(size * 0.25)
    
    # Base circle / rounded rect fill with gradient pink/purple
    bg_color = (220, 39, 67, 255) # Instagram brand pink-red
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=bg_color)

    # Inner dark circle
    margin = int(size * 0.12)
    draw.ellipse([margin, margin, size - margin - 1, size - margin - 1], fill=(18, 18, 18, 230))

    # Download arrow
    cx = size / 2.0
    cy = size / 2.0
    s = size / 16.0

    # Arrow stem
    stem_w = s * 2
    stem_h = s * 4
    draw.rectangle([cx - stem_w/2, cy - s * 3, cx + stem_w/2, cy + s], fill=(255, 255, 255, 255))

    # Arrow head (triangle)
    draw.polygon([
        (cx - s * 3.5, cy + s),
        (cx + s * 3.5, cy + s),
        (cx, cy + s * 4.5)
    ], fill=(255, 255, 255, 255))

    # Bottom bar
    bar_w = s * 7
    bar_h = s * 1.5
    draw.rectangle([cx - bar_w/2, cy + s * 5.5, cx + bar_w/2, cy + s * 5.5 + bar_h], fill=(255, 255, 255, 255))

    return img

icons_dir = os.path.dirname(__file__)
for s in [16, 48, 128]:
    icon_img = create_icon(s)
    icon_img.save(os.path.join(icons_dir, f'icon{s}.png'), 'PNG')
    print(f"Generated icon{s}.png")
