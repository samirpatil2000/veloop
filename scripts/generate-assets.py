import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_veloop_icon(size=512):
    # Create 512x512 RGBA image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background squircle
    pad = int(size * 0.06)
    radius = int(size * 0.22)
    bbox = [pad, pad, size - pad, size - pad]

    # Subtle shadow
    shadow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_img)
    shadow_draw.rounded_rectangle(bbox, radius=radius, fill=(0, 0, 0, 160))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(int(size * 0.04)))
    img.paste(shadow_img, (0, int(size * 0.02)), shadow_img)

    # Gradient background card
    card_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_img)
    card_draw.rounded_rectangle(bbox, radius=radius, fill=(15, 15, 18, 255), outline=(39, 39, 42, 255), width=max(1, int(size * 0.015)))

    img.paste(card_img, (0, 0), card_img)

    # 2. Draw loop / infinity track
    center_x = size // 2
    center_y = size // 2 - int(size * 0.01)
    loop_width = int(size * 0.58)
    loop_height = int(size * 0.32)
    thickness = max(3, int(size * 0.08))

    track_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    track_draw = ImageDraw.Draw(track_img)

    # Draw two interconnected circular loops (infinity shape)
    r = loop_height // 2
    left_cx = center_x - int(loop_width * 0.22)
    right_cx = center_x + int(loop_width * 0.22)

    # Left loop (emerald gradient feel)
    left_bbox = [left_cx - r, center_y - r, left_cx + r, center_y + r]
    track_draw.ellipse(left_bbox, outline=(34, 197, 94, 255), width=thickness)

    # Right loop (cyan/blue gradient feel)
    right_bbox = [right_cx - r, center_y - r, right_cx + r, center_y + r]
    track_draw.ellipse(right_bbox, outline=(6, 182, 212, 255), width=thickness)

    # Glowing center play triangle
    triangle_cx = center_x + int(size * 0.01)
    triangle_cy = center_y
    tri_size = int(size * 0.12)
    points = [
        (triangle_cx - tri_size // 2, triangle_cy - tri_size // 2),
        (triangle_cx - tri_size // 2, triangle_cy + tri_size // 2),
        (triangle_cx + tri_size // 2, triangle_cy)
    ]
    track_draw.polygon(points, fill=(255, 255, 255, 255))

    # Glow filter for futuristic feel
    glow_img = track_img.filter(ImageFilter.GaussianBlur(max(1, int(size * 0.02))))
    img.paste(glow_img, (0, 0), glow_img)
    img.paste(track_img, (0, 0), track_img)

    return img

def generate_icons(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    master = create_veloop_icon(512)
    sizes = [16, 32, 48, 128]
    for s in sizes:
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(output_dir, f"icon-{s}.png"), "PNG")
        print(f"Generated icon-{s}.png ({s}x{s})")

def create_small_promo_tile(output_path):
    w, h = 440, 280
    img = Image.new("RGB", (w, h), (12, 12, 14))
    draw = ImageDraw.Draw(img)

    # Soft radial background glow
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([w//2 - 120, h//2 - 100, w//2 + 120, h//2 + 100], fill=(34, 197, 94, 35))
    glow_draw.ellipse([w//2 - 60, h//2 - 60, w//2 + 60, h//2 + 60], fill=(6, 182, 212, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    img.paste(glow, (0, 0), glow)

    # Add icon
    icon = create_veloop_icon(180).resize((88, 88), Image.Resampling.LANCZOS)
    icon_x = (w - 88) // 2
    icon_y = 36
    img.paste(icon, (icon_x, icon_y), icon)

    # Fonts
    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/SFProDisplay-Bold.otf", 26)
        font_sub = ImageFont.truetype("/System/Library/Fonts/SFProText-Regular.otf", 13)
        font_pill = ImageFont.truetype("/System/Library/Fonts/SFProText-Medium.otf", 11)
    except:
        font_title = font_sub = font_pill = ImageFont.load_default()

    # Title
    title = "Veloop"
    tbox = draw.textbbox((0, 0), title, font=font_title)
    tw = tbox[2] - tbox[0]
    draw.text(((w - tw) // 2, 138), title, fill=(255, 255, 255), font=font_title)

    # Subtitle
    sub = "Instant Video Soundboard & Loop Pedal"
    sbox = draw.textbbox((0, 0), sub, font=font_sub)
    sw = sbox[2] - sbox[0]
    draw.text(((w - sw) // 2, 174), sub, fill=(161, 161, 170), font=font_sub)

    # Badge pill
    badge = "Google Meet  •  Zoom  •  Teams"
    bbox = draw.textbbox((0, 0), badge, font=font_pill)
    bw = bbox[2] - bbox[0]
    pill_w = bw + 24
    pill_h = 24
    pill_x = (w - pill_w) // 2
    pill_y = 212

    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=12, fill=(24, 24, 27), outline=(39, 39, 42))
    draw.text((pill_x + 12, pill_y + 4), badge, fill=(74, 222, 128), font=font_pill)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated promo tile: {output_path} ({w}x{h})")

def create_store_screenshot(output_path):
    w, h = 1280, 800
    img = Image.new("RGB", (w, h), (18, 18, 22))
    draw = ImageDraw.Draw(img)

    # 1. Background: Simulated modern WebRTC conference call backdrop
    # Conference header
    draw.rectangle([0, 0, w, 56], fill=(10, 10, 12))
    # Meeting title & time
    try:
        font_header = ImageFont.truetype("/System/Library/Fonts/SFProText-Medium.otf", 14)
        font_title = ImageFont.truetype("/System/Library/Fonts/SFProDisplay-Bold.otf", 34)
        font_desc = ImageFont.truetype("/System/Library/Fonts/SFProText-Regular.otf", 16)
        font_card_t = ImageFont.truetype("/System/Library/Fonts/SFProText-Bold.otf", 14)
        font_card_s = ImageFont.truetype("/System/Library/Fonts/SFProText-Regular.otf", 12)
        font_badge = ImageFont.truetype("/System/Library/Fonts/SFProText-Bold.otf", 12)
    except:
        font_header = font_title = font_desc = font_card_t = font_card_s = font_badge = ImageFont.load_default()

    draw.text((28, 18), "Google Meet  |  team-sync-q3", fill=(140, 140, 150), font=font_header)

    # Simulated participant video tile
    video_rect = [32, 76, 760, 710]
    draw.rounded_rectangle(video_rect, radius=16, fill=(28, 28, 34), outline=(45, 45, 55), width=2)

    # Participant silhouette / graphic in video feed
    center_vx = (video_rect[0] + video_rect[2]) // 2
    center_vy = (video_rect[1] + video_rect[3]) // 2
    # Head & shoulders avatar
    draw.ellipse([center_vx - 70, center_vy - 110, center_vx + 70, center_vy + 30], fill=(42, 42, 52))
    draw.ellipse([center_vx - 140, center_vy + 20, center_vx + 140, center_vy + 260], fill=(42, 42, 52))

    # Participant tag on video
    draw.rounded_rectangle([video_rect[0] + 20, video_rect[3] - 48, video_rect[0] + 160, video_rect[3] - 16], radius=6, fill=(0, 0, 0, 180))
    draw.text((video_rect[0] + 32, video_rect[3] - 40), "Samir Patil (You)", fill=(240, 240, 240), font=font_header)

    # Active LOOP tag on the video tile
    loop_tag = [video_rect[2] - 170, video_rect[1] + 20, video_rect[2] - 20, video_rect[1] + 56]
    draw.rounded_rectangle(loop_tag, radius=8, fill=(16, 185, 129), outline=(5, 150, 105))
    draw.text((loop_tag[0] + 16, loop_tag[1] + 8), "● LOOP ACTIVE", fill=(5, 46, 22), font=font_badge)

    # 2. Right Column: The Veloop Extension Overlay Popup
    popup_x = 810
    popup_y = 96
    popup_w = 430
    popup_h = 580
    popup_rect = [popup_x, popup_y, popup_x + popup_w, popup_y + popup_h]

    # Popup drop shadow
    shadow_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    s_draw.rounded_rectangle(popup_rect, radius=20, fill=(0, 0, 0, 220))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(30))
    img.paste(shadow_img, (0, 0), shadow_img)

    # Popup container
    draw.rounded_rectangle(popup_rect, radius=20, fill=(18, 18, 22), outline=(50, 50, 60), width=2)

    # Popup Header
    draw.text((popup_x + 24, popup_y + 22), "Veloop", fill=(255, 255, 255), font=font_title)
    draw.rounded_rectangle([popup_x + popup_w - 140, popup_y + 24, popup_x + popup_w - 24, popup_y + 54], radius=6, fill=(30, 41, 59))
    draw.text((popup_x + popup_w - 130, popup_y + 30), "Camera Off", fill=(99, 179, 237), font=font_card_s)

    # Hero card
    hero_rect = [popup_x + 24, popup_y + 74, popup_x + popup_w - 24, popup_y + 164]
    draw.rounded_rectangle(hero_rect, radius=12, fill=(24, 24, 30), outline=(42, 42, 50))
    draw.text((hero_rect[0] + 140, hero_rect[1] + 16), "PLAYING", fill=(99, 179, 237), font=font_title)
    draw.text((hero_rect[0] + 80, hero_rect[1] + 58), "Preset loop active (Camera LED is OFF)", fill=(140, 140, 150), font=font_card_s)

    # Primary action buttons
    btn1 = [popup_x + 24, popup_y + 176, popup_x + popup_w - 24, popup_y + 214]
    draw.rounded_rectangle(btn1, radius=8, fill=(255, 255, 255))
    draw.text((btn1[0] + 120, btn1[1] + 9), "Record New Loop", fill=(10, 10, 12), font=font_card_t)

    btn2 = [popup_x + 24, popup_y + 224, popup_x + popup_w - 24, popup_y + 262]
    draw.rounded_rectangle(btn2, radius=8, fill=(36, 36, 44))
    draw.text((btn2[0] + 155, btn2[1] + 9), "Go Live", fill=(240, 240, 245), font=font_card_t)

    # Soundboard Presets list
    draw.text((popup_x + 24, popup_y + 280), "PRESETS SOUNDBOARD", fill=(140, 140, 155), font=font_badge)

    presets = [
        ("Attentive Nodding", "3.4s loop", True),
        ("Sipping Coffee", "6.1s loop", False),
        ("Looking at Notes", "4.8s loop", False),
        ("Deep Thought", "5.2s loop", False),
    ]

    card_y = popup_y + 308
    for title, meta, is_active in presets:
        p_card = [popup_x + 24, card_y, popup_x + popup_w - 24, card_y + 54]
        if is_active:
            draw.rounded_rectangle(p_card, radius=10, fill=(20, 39, 58), outline=(49, 130, 206), width=2)
            play_fill = (99, 179, 237)
        else:
            draw.rounded_rectangle(p_card, radius=10, fill=(25, 25, 30), outline=(40, 40, 48))
            play_fill = (160, 160, 170)

        # Thumbnail box
        draw.rounded_rectangle([p_card[0] + 8, p_card[1] + 8, p_card[0] + 62, p_card[3] - 8], radius=6, fill=(10, 10, 12))
        draw.polygon([
            (p_card[0] + 32, p_card[1] + 18),
            (p_card[0] + 32, p_card[1] + 34),
            (p_card[0] + 44, p_card[1] + 26)
        ], fill=play_fill)

        # Title & duration
        draw.text((p_card[0] + 74, p_card[1] + 9), title, fill=(255, 255, 255) if is_active else (220, 220, 225), font=font_card_t)
        draw.text((p_card[0] + 74, p_card[1] + 29), meta, fill=(120, 120, 130), font=font_card_s)

        card_y += 62

    # Bottom feature bar
    draw.rectangle([0, h - 70, w, h], fill=(12, 12, 15))
    features = "✓  Instant Video Loop Pedal   |   ✓  1-Tap Soundboard Presets   |   ✓  Camera Hardware LED Off During Loops"
    fbox = draw.textbbox((0, 0), features, font=font_desc)
    fw = fbox[2] - fbox[0]
    draw.text(((w - fw) // 2, h - 45), features, fill=(74, 222, 128), font=font_desc)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated store screenshot: {output_path} ({w}x{h})")

if __name__ == "__main__":
    generate_icons("extension/icons")
    create_small_promo_tile("store-assets/veloop-promo-440x280.png")
    create_store_screenshot("store-assets/veloop-screenshot-1280x800.png")
