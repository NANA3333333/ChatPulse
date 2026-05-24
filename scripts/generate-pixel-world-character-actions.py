from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_DIR = ROOT / "client/public/assets/pixel-world/characters/casual-boy-v1"
FRAMES_DIR = CHARACTER_DIR / "frames-64x80"
ACTIONS_DIR = CHARACTER_DIR / "actions-64x80"
FRAME_SIZE = (64, 80)
PIVOT = {"x": 32, "y": 72}


INK = (42, 34, 31, 255)
INK_SOFT = (78, 62, 52, 255)
SHOE = (62, 48, 40, 255)
SHOE_DARK = (35, 29, 27, 255)
PANTS = (82, 78, 72, 255)
PANTS_LIGHT = (109, 103, 94, 255)
PANTS_SHADOW = (48, 45, 42, 255)
WHITE = (244, 239, 229, 255)
WHITE_SHADOW = (207, 201, 188, 255)
BLUE = (92, 158, 225, 255)
BLUE_DARK = (42, 103, 173, 255)
BLUE_LIGHT = (160, 213, 252, 255)
YELLOW = (248, 207, 72, 255)
YELLOW_PALE = (255, 232, 135, 255)
PAPER = (250, 247, 236, 255)
SKIN = (254, 227, 199, 255)
SKIN_SHADE = (248, 205, 174, 255)


def load_frame(name: str) -> Image.Image:
    return Image.open(FRAMES_DIR / f"{name}.png").convert("RGBA")


def blank() -> Image.Image:
    return Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))


def clear_rect(img: Image.Image, box: tuple[int, int, int, int]) -> None:
    pixels = img.load()
    x0, y0, x1, y1 = box
    for y in range(max(0, y0), min(img.height, y1)):
        for x in range(max(0, x0), min(img.width, x1)):
            pixels[x, y] = (0, 0, 0, 0)


def paste_region_shifted(
    img: Image.Image,
    box: tuple[int, int, int, int],
    dx: int,
    dy: int,
    clear: tuple[int, int, int, int] | None = None,
) -> Image.Image:
    out = img.copy()
    region = img.crop(box)
    clear_rect(out, clear or box)
    out.alpha_composite(region, (box[0] + dx, box[1] + dy))
    return out


def draw_pixel_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=fill)


def draw_tiny_bubble(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw_pixel_rect(draw, (x + 1, y, x + w - 1, y + h), INK)
    draw_pixel_rect(draw, (x, y + 1, x + w, y + h - 1), INK)
    if w > 5 and h > 5:
        draw_pixel_rect(draw, (x + 2, y + 2, x + w - 2, y + h - 2), PAPER)
    else:
        draw_pixel_rect(draw, (x + 2, y + 2, x + w - 1, y + h - 1), PAPER)


def save_frame(name: str, img: Image.Image, produced: dict[str, Image.Image]) -> None:
    img.save(ACTIONS_DIR / f"{name}.png")
    produced[name] = img


def make_talk(base: Image.Image, direction: str) -> list[tuple[str, Image.Image]]:
    frames = []
    head_box = (8, 8, 56, 42)
    clear_box = (7, 7, 57, 43)
    offsets = [(0, 0), (0, -1), (1 if direction == "left" else -1 if direction == "right" else 0, 0), (0, -1)]
    for index, (dx, dy) in enumerate(offsets, 1):
        frame = paste_region_shifted(base, head_box, dx, dy, clear_box)
        frames.append((f"{direction}_talk_{index:02d}", frame))
    return frames


def make_surprised(front: Image.Image) -> list[tuple[str, Image.Image]]:
    frames = []
    frames.append(("front_emote_surprised_01", front.copy()))

    second = paste_region_shifted(front, (8, 8, 56, 42), 0, -1, (7, 7, 57, 43))
    d = ImageDraw.Draw(second)
    draw_pixel_rect(d, (49, 9, 52, 17), YELLOW)
    draw_pixel_rect(d, (50, 17, 53, 20), INK)
    d.point((48, 11), fill=INK)
    frames.append(("front_emote_surprised_02", second))

    third = paste_region_shifted(front, (8, 8, 56, 42), 0, -2, (7, 7, 57, 44))
    d = ImageDraw.Draw(third)
    draw_pixel_rect(d, (49, 8, 52, 17), YELLOW_PALE)
    draw_pixel_rect(d, (50, 17, 53, 20), INK)
    draw_pixel_rect(d, (14, 16, 17, 19), BLUE)
    draw_pixel_rect(d, (18, 12, 20, 15), BLUE_DARK)
    draw_pixel_rect(d, (44, 12, 46, 15), BLUE)
    frames.append(("front_emote_surprised_03", third))
    return frames


def make_think(front: Image.Image) -> list[tuple[str, Image.Image]]:
    frames = []
    positions = [
        [(48, 15, 4, 4)],
        [(46, 14, 4, 4), (51, 10, 8, 6)],
        [(45, 15, 4, 4), (50, 10, 8, 6), (55, 7, 6, 5)],
        [(46, 16, 4, 4), (51, 11, 8, 6)],
    ]
    for index, bubbles in enumerate(positions, 1):
        frame = paste_region_shifted(front, (8, 8, 56, 42), 0, 0 if index != 3 else -1, (7, 7, 57, 43))
        d = ImageDraw.Draw(frame)
        for x, y, w, h in bubbles:
            draw_tiny_bubble(d, x, y, w, h)
        frames.append((f"front_emote_think_{index:02d}", frame))
    return frames


def make_down(front: Image.Image) -> list[tuple[str, Image.Image]]:
    frames = []
    offsets = [(0, 0), (0, 1), (0, 2), (0, 1)]
    for index, (dx, dy) in enumerate(offsets, 1):
        frame = paste_region_shifted(front, (8, 8, 56, 44), dx, dy, (7, 7, 57, 46))
        d = ImageDraw.Draw(frame)
        if index >= 2:
            draw_pixel_rect(d, (13, 14, 15, 23), BLUE)
            draw_pixel_rect(d, (17, 16, 19, 25), BLUE_DARK)
        if index == 3:
            draw_pixel_rect(d, (21, 15, 23, 23), BLUE)
        frames.append((f"front_emote_down_{index:02d}", frame))
    return frames


def clear_front_eyes(draw: ImageDraw.ImageDraw) -> None:
    draw_pixel_rect(draw, (23, 34, 29, 40), SKIN)
    draw_pixel_rect(draw, (36, 34, 42, 40), SKIN)
    draw_pixel_rect(draw, (24, 39, 28, 41), SKIN_SHADE)
    draw_pixel_rect(draw, (37, 39, 41, 41), SKIN_SHADE)


def draw_tear_stream(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    length: int,
    width: int = 1,
    lean: int = 0,
) -> None:
    for row in range(length):
        px = x + (lean if row > length * 2 // 3 else 0)
        draw_pixel_rect(draw, (px, y + row, px + width, y + row + 1), BLUE)
        if row % 3 == 1:
            draw.point((px + width, y + row), fill=BLUE_LIGHT)
    if length >= 7:
        drop_y = y + length
        draw.point((x + lean, drop_y), fill=BLUE_LIGHT)
        draw.point((x + lean, drop_y + 1), fill=BLUE)


def draw_cry_face(
    frame: Image.Image,
    index: int,
    tear_left: int,
    tear_right: int,
    closed: bool,
    shake_marks: bool = False,
) -> None:
    d = ImageDraw.Draw(frame)
    clear_front_eyes(d)
    draw_pixel_rect(d, (26, 40, 39, 42), SKIN)
    draw_pixel_rect(d, (28, 42, 37, 43), SKIN_SHADE)
    if closed:
        d.point((26, 35), fill=INK)
        d.point((27, 36), fill=INK)
        d.point((28, 36), fill=INK_SOFT)
        d.point((38, 35), fill=INK)
        d.point((37, 36), fill=INK)
        d.point((36, 36), fill=INK_SOFT)
    else:
        draw_pixel_rect(d, (25, 35, 27, 39), INK)
        draw_pixel_rect(d, (38, 35, 40, 39), INK)
        d.point((28, 34), fill=INK_SOFT)
        d.point((37, 34), fill=INK_SOFT)

    if tear_left:
        draw_tear_stream(d, 26, 38, tear_left, 1, -1 if index % 6 == 0 else 0)
    if tear_right:
        draw_tear_stream(d, 37, 38, tear_right, 1, 1 if index % 6 == 3 else 0)

    if tear_left >= 7:
        d.point((25, 46), fill=BLUE_LIGHT)
    if tear_right >= 7:
        d.point((38, 46), fill=BLUE_LIGHT)


def make_cry(front: Image.Image) -> list[tuple[str, Image.Image]]:
    frames = []
    variants = [
        (0, 0, False),
        (2, 1, False),
        (4, 3, False),
        (5, 5, True),
        (7, 6, True),
        (8, 8, True),
        (8, 8, True),
        (8, 8, True),
        (8, 8, True),
        (7, 8, True),
        (6, 7, False),
        (8, 6, True),
        (8, 8, True),
        (8, 7, True),
        (5, 6, False),
        (3, 3, False),
    ]
    for index, (tear_left, tear_right, closed) in enumerate(variants, 1):
        frame = front.copy()
        draw_cry_face(frame, index, tear_left, tear_right, closed)
        frames.append((f"front_emote_cry_{index:02d}", frame))
    return frames


def erase_standing_legs(img: Image.Image, direction: str, amount: int) -> Image.Image:
    out = img.copy()
    if direction == "front":
        clear_rect(out, (20, 54 - amount, 44, 76))
        clear_rect(out, (16, 66 - amount, 48, 76))
    elif direction == "left":
        clear_rect(out, (18, 54 - amount, 46, 76))
        clear_rect(out, (15, 66 - amount, 48, 76))
    else:
        clear_rect(out, (18, 54 - amount, 46, 76))
        clear_rect(out, (16, 66 - amount, 49, 76))
    return out


def lower_upper_body(base: Image.Image, direction: str, drop: int, cut_y: int) -> Image.Image:
    out = blank()
    upper = base.crop((0, 0, 64, cut_y))
    out.alpha_composite(upper, (0, drop))
    return erase_standing_legs(out, direction, max(0, 2 - drop))


def draw_front_seated_lower(draw: ImageDraw.ImageDraw, y: int, variant: int) -> None:
    left_x = 21 if variant != 2 else 22
    right_x = 34 if variant != 2 else 33
    draw_pixel_rect(draw, (left_x, y, left_x + 10, y + 7), INK)
    draw_pixel_rect(draw, (right_x, y, right_x + 10, y + 7), INK)
    draw_pixel_rect(draw, (left_x + 1, y + 1, left_x + 9, y + 6), PANTS)
    draw_pixel_rect(draw, (right_x + 1, y + 1, right_x + 9, y + 6), PANTS)
    draw_pixel_rect(draw, (left_x + 2, y + 1, left_x + 7, y + 3), PANTS_LIGHT)
    draw_pixel_rect(draw, (right_x + 3, y + 1, right_x + 8, y + 3), PANTS_LIGHT)
    draw_pixel_rect(draw, (left_x + 2, y + 5, left_x + 9, y + 7), PANTS_SHADOW)
    draw_pixel_rect(draw, (right_x + 1, y + 5, right_x + 8, y + 7), PANTS_SHADOW)
    draw_pixel_rect(draw, (left_x, y + 7, left_x + 8, y + 10), SHOE_DARK)
    draw_pixel_rect(draw, (right_x + 2, y + 7, right_x + 10, y + 10), SHOE_DARK)
    draw_pixel_rect(draw, (left_x + 2, y + 7, left_x + 8, y + 9), SHOE)
    draw_pixel_rect(draw, (right_x + 2, y + 7, right_x + 8, y + 9), SHOE)


def draw_side_seated_lower(draw: ImageDraw.ImageDraw, direction: str, y: int, variant: int) -> None:
    face_left = direction == "left"
    if face_left:
        hip = 31
        front_foot = 18 if variant != 2 else 17
        knee = 23
        back_foot = 32
        draw_pixel_rect(draw, (knee, y, hip + 4, y + 6), INK)
        draw_pixel_rect(draw, (knee + 1, y + 1, hip + 3, y + 5), PANTS)
        draw_pixel_rect(draw, (knee + 1, y + 1, hip + 1, y + 3), PANTS_LIGHT)
        draw_pixel_rect(draw, (knee, y + 5, hip + 3, y + 7), PANTS_SHADOW)
        draw_pixel_rect(draw, (front_foot, y + 7, front_foot + 8, y + 10), SHOE_DARK)
        draw_pixel_rect(draw, (front_foot + 2, y + 7, front_foot + 8, y + 9), SHOE)
        draw_pixel_rect(draw, (back_foot, y + 5, back_foot + 6, y + 9), INK)
        draw_pixel_rect(draw, (back_foot + 1, y + 6, back_foot + 5, y + 8), PANTS_SHADOW)
        draw_pixel_rect(draw, (back_foot + 1, y + 9, back_foot + 7, y + 11), SHOE_DARK)
    else:
        hip = 33
        front_foot = 37 if variant != 2 else 38
        knee = 29
        back_foot = 26
        draw_pixel_rect(draw, (hip - 4, y, knee + 10, y + 6), INK)
        draw_pixel_rect(draw, (hip - 3, y + 1, knee + 9, y + 5), PANTS)
        draw_pixel_rect(draw, (hip - 1, y + 1, knee + 8, y + 3), PANTS_LIGHT)
        draw_pixel_rect(draw, (hip - 3, y + 5, knee + 10, y + 7), PANTS_SHADOW)
        draw_pixel_rect(draw, (front_foot, y + 7, front_foot + 8, y + 10), SHOE_DARK)
        draw_pixel_rect(draw, (front_foot, y + 7, front_foot + 6, y + 9), SHOE)
        draw_pixel_rect(draw, (back_foot, y + 5, back_foot + 6, y + 9), INK)
        draw_pixel_rect(draw, (back_foot + 1, y + 6, back_foot + 5, y + 8), PANTS_SHADOW)
        draw_pixel_rect(draw, (back_foot - 1, y + 9, back_foot + 5, y + 11), SHOE_DARK)


def make_sit(base: Image.Image, direction: str) -> list[tuple[str, Image.Image]]:
    frames = []
    first = base.copy()
    frames.append((f"{direction}_sit_01", first))

    second = lower_upper_body(base, direction, 1, 62)
    d = ImageDraw.Draw(second)
    if direction == "front":
        draw_front_seated_lower(d, 60, 1)
    else:
        draw_side_seated_lower(d, direction, 60, 1)
    frames.append((f"{direction}_sit_02", second))

    third = lower_upper_body(base, direction, 3, 61)
    d = ImageDraw.Draw(third)
    if direction == "front":
        draw_front_seated_lower(d, 62, 1)
    else:
        draw_side_seated_lower(d, direction, 62, 1)
    frames.append((f"{direction}_sit_03", third))

    idle_a = third.copy()
    frames.append((f"{direction}_sit_idle_01", idle_a))

    idle_b = lower_upper_body(base, direction, 2, 61)
    d = ImageDraw.Draw(idle_b)
    if direction == "front":
        draw_front_seated_lower(d, 61, 2)
    else:
        draw_side_seated_lower(d, direction, 61, 2)
    frames.append((f"{direction}_sit_idle_02", idle_b))
    return frames


def write_alias(alias: str, target: str, produced: dict[str, Image.Image], aliases: dict[str, str]) -> None:
    produced[target].save(ACTIONS_DIR / f"{alias}.png")
    aliases[alias] = target


def make_sheet(produced: dict[str, Image.Image], names: list[str]) -> Image.Image:
    cols = 8
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 64, rows * 80), (0, 0, 0, 0))
    for index, name in enumerate(names):
        x = index % cols * 64
        y = index // cols * 80
        sheet.alpha_composite(produced[name], (x, y))
    return sheet


def checker(size: tuple[int, int], tile: int = 8) -> Image.Image:
    img = Image.new("RGBA", size, (245, 241, 233, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                d.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(238, 233, 223, 255))
    return img


def make_preview(sheet: Image.Image) -> Image.Image:
    scale = 2
    bg = checker((sheet.width * scale, sheet.height * scale), 16)
    enlarged = sheet.resize(bg.size, Image.Resampling.NEAREST)
    bg.alpha_composite(enlarged)
    d = ImageDraw.Draw(bg)
    for x in range(0, bg.width, 64 * scale):
        d.line((x, 0, x, bg.height), fill=(214, 207, 196, 255), width=1)
    for y in range(0, bg.height, 80 * scale):
        d.line((0, y, bg.width, y), fill=(214, 207, 196, 255), width=1)
    return bg


def make_gif(path: Path, frames: list[Image.Image], duration: int = 140) -> None:
    scaled_frames = []
    for frame in frames:
        bg = checker((128, 160), 16)
        bg.alpha_composite(frame.resize((128, 160), Image.Resampling.NEAREST))
        scaled_frames.append(bg.convert("P", palette=Image.Palette.ADAPTIVE))
    scaled_frames[0].save(
        path,
        save_all=True,
        append_images=scaled_frames[1:],
        loop=0,
        duration=duration,
        disposal=2,
    )


def update_manifest(action_names: list[str], aliases: dict[str, str]) -> None:
    manifest_path = CHARACTER_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.setdefault("files", {})
    manifest["files"]["actionsDir"] = "actions-64x80/"
    manifest["files"]["actionsSheet"] = "casual-boy-actions-sheet-64x80.png"
    manifest["files"]["actionsPreview"] = "preview-casual-boy-actions-2x.png"
    manifest["files"]["actionPreviewGifs"] = {
        "talk": "preview-casual-boy-action-talk.gif",
        "surprised": "preview-casual-boy-action-surprised.gif",
        "think": "preview-casual-boy-action-think.gif",
        "down": "preview-casual-boy-action-down.gif",
        "cry": "preview-casual-boy-action-cry.gif",
        "sitFront": "preview-casual-boy-action-sit-front.gif",
        "sitLeft": "preview-casual-boy-action-sit-left.gif",
        "sitRight": "preview-casual-boy-action-sit-right.gif",
    }
    manifest["actions"] = {
        "talk": {
            direction: [f"{direction}_talk_{index:02d}" for index in range(1, 5)]
            for direction in ("front", "left", "right", "back")
        },
        "emotes": {
            "surprised": [f"front_emote_surprised_{index:02d}" for index in range(1, 4)],
            "think": [f"front_emote_think_{index:02d}" for index in range(1, 5)],
            "down": [f"front_emote_down_{index:02d}" for index in range(1, 5)],
            "cry": [f"front_emote_cry_{index:02d}" for index in range(1, 17)],
        },
        "sit": {
            direction: [
                f"{direction}_sit_01",
                f"{direction}_sit_02",
                f"{direction}_sit_03",
                f"{direction}_sit_idle_01",
                f"{direction}_sit_idle_02",
            ]
            for direction in ("front", "left", "right")
        },
        "compatibilityAliases": aliases,
    }
    all_pngs = action_names + list(aliases.keys())
    manifest["actionFrames"] = [
        {
            "name": name,
            "path": f"actions-64x80/{name}.png",
            "width": 64,
            "height": 80,
            "pivot": PIVOT,
            "feet": PIVOT,
            **({"aliasOf": aliases[name]} if name in aliases else {}),
        }
        for name in all_pngs
    ]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    for old in ACTIONS_DIR.glob("*.png"):
        old.unlink()

    bases = {
        "front": load_frame("front_walk_idle"),
        "left": load_frame("left_walk_idle"),
        "right": load_frame("right_walk_idle"),
        "back": load_frame("back_walk_idle"),
    }

    produced: dict[str, Image.Image] = {}
    action_names: list[str] = []

    groups: list[list[tuple[str, Image.Image]]] = []
    groups.extend(make_talk(bases[direction], direction) for direction in ("front", "left", "right", "back"))
    groups.append(make_surprised(bases["front"]))
    groups.append(make_think(bases["front"]))
    groups.append(make_down(bases["front"]))
    groups.append(make_cry(bases["front"]))
    groups.extend(make_sit(bases[direction], direction) for direction in ("front", "left", "right"))

    for group in groups:
        for name, frame in group:
            save_frame(name, frame, produced)
            action_names.append(name)

    aliases: dict[str, str] = {}
    write_alias("front_emote_surprised", "front_emote_surprised_03", produced, aliases)
    write_alias("front_emote_think", "front_emote_think_02", produced, aliases)
    write_alias("front_emote_down", "front_emote_down_03", produced, aliases)
    write_alias("front_emote_cry", "front_emote_cry_09", produced, aliases)
    write_alias("front_sit_idle", "front_sit_idle_01", produced, aliases)
    write_alias("left_sit_idle", "left_sit_idle_01", produced, aliases)
    write_alias("right_sit_idle", "right_sit_idle_01", produced, aliases)

    sheet = make_sheet(produced, action_names)
    sheet.save(CHARACTER_DIR / "casual-boy-actions-sheet-64x80.png")
    make_preview(sheet).save(CHARACTER_DIR / "preview-casual-boy-actions-2x.png")

    make_gif(
        CHARACTER_DIR / "preview-casual-boy-action-talk.gif",
        [produced[f"front_talk_{index:02d}"] for index in range(1, 5)],
    )
    make_gif(
        CHARACTER_DIR / "preview-casual-boy-action-surprised.gif",
        [produced[f"front_emote_surprised_{index:02d}"] for index in range(1, 4)],
    )
    make_gif(
        CHARACTER_DIR / "preview-casual-boy-action-think.gif",
        [produced[f"front_emote_think_{index:02d}"] for index in range(1, 5)],
    )
    make_gif(
        CHARACTER_DIR / "preview-casual-boy-action-down.gif",
        [produced[f"front_emote_down_{index:02d}"] for index in range(1, 5)],
    )
    make_gif(
        CHARACTER_DIR / "preview-casual-boy-action-cry.gif",
        [produced[f"front_emote_cry_{index:02d}"] for index in range(1, 17)],
        duration=120,
    )
    for direction in ("front", "left", "right"):
        make_gif(
            CHARACTER_DIR / f"preview-casual-boy-action-sit-{direction}.gif",
            [
                produced[f"{direction}_sit_01"],
                produced[f"{direction}_sit_02"],
                produced[f"{direction}_sit_03"],
                produced[f"{direction}_sit_idle_01"],
                produced[f"{direction}_sit_idle_02"],
            ],
            duration=160,
        )

    update_manifest(action_names, aliases)
    print(f"Generated {len(action_names)} action frames and {len(aliases)} compatibility aliases.")


if __name__ == "__main__":
    main()
