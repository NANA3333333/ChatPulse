from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REFERENCE_IMAGE = Path(r"C:\Users\Nana\Desktop\b45b18e7-25f7-41e5-836a-4400087166ce.png")

OBJ_PATH = ROOT / "chibi_two_head_4_4.obj"
MTL_PATH = ROOT / "chibi_two_head_4_4.mtl"
PREVIEW_PATH = ROOT / "preview_front_side.png"
REFERENCE_CROP_PATH = ROOT / "reference_4_4_assumed_crop.png"
PROPORTIONS_PATH = ROOT / "proportions.json"


MATERIALS = {
    "skin": (1.0, 0.77, 0.67),
    "skin_shadow": (0.94, 0.56, 0.48),
    "hair": (0.68, 0.50, 0.45),
    "hair_shadow": (0.43, 0.29, 0.27),
    "hair_highlight": (0.88, 0.68, 0.60),
    "eye_blue": (0.07, 0.55, 0.88),
    "eye_dark": (0.02, 0.12, 0.22),
    "eye_light": (0.88, 0.98, 1.0),
    "white_cloth": (0.98, 0.97, 0.94),
    "cloth_shadow": (0.78, 0.78, 0.74),
    "mouth": (0.55, 0.16, 0.13),
    "hair_band": (0.25, 0.17, 0.16),
    "guide": (0.35, 0.42, 0.48),
}


def rot_x(deg: float) -> np.ndarray:
    a = math.radians(deg)
    return np.array(
        [
            [1, 0, 0],
            [0, math.cos(a), -math.sin(a)],
            [0, math.sin(a), math.cos(a)],
        ],
        dtype=float,
    )


def rot_y(deg: float) -> np.ndarray:
    a = math.radians(deg)
    return np.array(
        [
            [math.cos(a), 0, math.sin(a)],
            [0, 1, 0],
            [-math.sin(a), 0, math.cos(a)],
        ],
        dtype=float,
    )


def rot_z(deg: float) -> np.ndarray:
    a = math.radians(deg)
    return np.array(
        [
            [math.cos(a), -math.sin(a), 0],
            [math.sin(a), math.cos(a), 0],
            [0, 0, 1],
        ],
        dtype=float,
    )


class Mesh:
    def __init__(self) -> None:
        self.vertices: list[np.ndarray] = []
        self.faces: list[tuple[str, str, list[int]]] = []

    def add_vertex(self, point: np.ndarray | tuple[float, float, float]) -> int:
        self.vertices.append(np.array(point, dtype=float))
        return len(self.vertices)

    def add_face(self, group: str, material: str, indices: list[int]) -> None:
        self.faces.append((group, material, indices))

    def add_ellipsoid(
        self,
        group: str,
        center: tuple[float, float, float],
        radii: tuple[float, float, float],
        material: str,
        segments: int = 32,
        rings: int = 16,
        transform: np.ndarray | None = None,
        theta_min: float = 0.0,
        theta_max: float = math.pi,
        phi_min: float = 0.0,
        phi_max: float = math.tau,
        wrap_phi: bool = True,
    ) -> None:
        c = np.array(center, dtype=float)
        r = np.array(radii, dtype=float)
        transform = transform if transform is not None else np.identity(3)
        rows: list[list[int]] = []
        phi_count = segments if wrap_phi else segments + 1
        for i in range(rings + 1):
            theta = theta_min + (theta_max - theta_min) * i / rings
            row: list[int] = []
            for j in range(phi_count):
                phi = phi_min + (phi_max - phi_min) * j / segments
                local = np.array(
                    [
                        r[0] * math.sin(theta) * math.cos(phi),
                        r[1] * math.sin(theta) * math.sin(phi),
                        r[2] * math.cos(theta),
                    ],
                    dtype=float,
                )
                row.append(self.add_vertex(c + transform @ local))
            rows.append(row)

        last_col = segments if wrap_phi else segments - 1
        for i in range(rings):
            for j in range(last_col):
                j2 = (j + 1) % segments if wrap_phi else j + 1
                self.add_face(group, material, [rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]])

    def add_cylinder(
        self,
        group: str,
        p1: tuple[float, float, float],
        p2: tuple[float, float, float],
        radius: float,
        material: str,
        segments: int = 18,
        cap: bool = True,
    ) -> None:
        a = np.array(p1, dtype=float)
        b = np.array(p2, dtype=float)
        axis = b - a
        length = np.linalg.norm(axis)
        if length < 1e-6:
            return
        w = axis / length
        helper = np.array([0.0, 0.0, 1.0]) if abs(w[2]) < 0.92 else np.array([1.0, 0.0, 0.0])
        u = np.cross(w, helper)
        u /= np.linalg.norm(u)
        v = np.cross(w, u)

        ring_a: list[int] = []
        ring_b: list[int] = []
        for i in range(segments):
            t = math.tau * i / segments
            offset = radius * (math.cos(t) * u + math.sin(t) * v)
            ring_a.append(self.add_vertex(a + offset))
            ring_b.append(self.add_vertex(b + offset))

        for i in range(segments):
            j = (i + 1) % segments
            self.add_face(group, material, [ring_a[i], ring_a[j], ring_b[j], ring_b[i]])

        if cap:
            ca = self.add_vertex(a)
            cb = self.add_vertex(b)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_face(group, material, [ca, ring_a[i], ring_a[j]])
                self.add_face(group, material, [cb, ring_b[j], ring_b[i]])

    def add_capsule(
        self,
        group: str,
        p1: tuple[float, float, float],
        p2: tuple[float, float, float],
        radius: float,
        material: str,
        segments: int = 18,
    ) -> None:
        self.add_cylinder(group, p1, p2, radius, material, segments=segments)
        self.add_ellipsoid(f"{group}_cap_a", p1, (radius, radius, radius), material, segments=segments, rings=8)
        self.add_ellipsoid(f"{group}_cap_b", p2, (radius, radius, radius), material, segments=segments, rings=8)

    def add_box(
        self,
        group: str,
        center: tuple[float, float, float],
        size: tuple[float, float, float],
        material: str,
    ) -> None:
        cx, cy, cz = center
        sx, sy, sz = (size[0] / 2, size[1] / 2, size[2] / 2)
        points = [
            (cx - sx, cy - sy, cz - sz),
            (cx + sx, cy - sy, cz - sz),
            (cx + sx, cy + sy, cz - sz),
            (cx - sx, cy + sy, cz - sz),
            (cx - sx, cy - sy, cz + sz),
            (cx + sx, cy - sy, cz + sz),
            (cx + sx, cy + sy, cz + sz),
            (cx - sx, cy + sy, cz + sz),
        ]
        ids = [self.add_vertex(p) for p in points]
        quads = [
            [0, 1, 2, 3],
            [4, 7, 6, 5],
            [0, 4, 5, 1],
            [1, 5, 6, 2],
            [2, 6, 7, 3],
            [3, 7, 4, 0],
        ]
        for q in quads:
            self.add_face(group, material, [ids[i] for i in q])

    def add_flat_ellipse(
        self,
        group: str,
        center: tuple[float, float, float],
        rx: float,
        rz: float,
        material: str,
        segments: int = 28,
        transform: np.ndarray | None = None,
    ) -> None:
        c = np.array(center, dtype=float)
        transform = transform if transform is not None else np.identity(3)
        mid = self.add_vertex(c)
        ring: list[int] = []
        for i in range(segments):
            t = math.tau * i / segments
            local = np.array([rx * math.cos(t), 0.0, rz * math.sin(t)], dtype=float)
            ring.append(self.add_vertex(c + transform @ local))
        for i in range(segments):
            self.add_face(group, material, [mid, ring[i], ring[(i + 1) % segments]])

    def write_obj(self, path: Path, material_library: str) -> None:
        lines = [f"mtllib {material_library}", "o chibi_two_head_4_4"]
        for vertex in self.vertices:
            lines.append(f"v {vertex[0]:.6f} {vertex[1]:.6f} {vertex[2]:.6f}")

        current_group = None
        current_material = None
        for group, material, indices in self.faces:
            if group != current_group:
                lines.append(f"g {group}")
                current_group = group
            if material != current_material:
                lines.append(f"usemtl {material}")
                current_material = material
            lines.append("f " + " ".join(str(i) for i in indices))
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_mtl(path: Path) -> None:
    chunks: list[str] = []
    for name, color in MATERIALS.items():
        r, g, b = color
        chunks.extend(
            [
                f"newmtl {name}",
                f"Ka {r * 0.35:.4f} {g * 0.35:.4f} {b * 0.35:.4f}",
                f"Kd {r:.4f} {g:.4f} {b:.4f}",
                "Ks 0.0500 0.0500 0.0500",
                "Ns 12.0000",
                "illum 2",
                "",
            ]
        )
    path.write_text("\n".join(chunks), encoding="utf-8")


def build_model() -> Mesh:
    mesh = Mesh()

    # Fixed blockout: one head unit above one body unit.
    mesh.add_ellipsoid("head", (0.0, -0.01, 1.47), (0.47, 0.39, 0.50), "skin", segments=36, rings=18)
    mesh.add_ellipsoid("body_cloth", (0.0, -0.005, 0.61), (0.29, 0.17, 0.34), "white_cloth", segments=30, rings=14)
    mesh.add_ellipsoid("neck", (0.0, -0.01, 0.94), (0.11, 0.09, 0.08), "skin", segments=20, rings=8)

    mesh.add_capsule("left_arm", (-0.32, -0.02, 0.76), (-0.38, -0.03, 0.38), 0.055, "skin", segments=18)
    mesh.add_capsule("right_arm", (0.32, -0.02, 0.76), (0.38, -0.03, 0.38), 0.055, "skin", segments=18)
    mesh.add_ellipsoid("left_hand", (-0.39, -0.04, 0.34), (0.06, 0.05, 0.065), "skin", segments=18, rings=8)
    mesh.add_ellipsoid("right_hand", (0.39, -0.04, 0.34), (0.06, 0.05, 0.065), "skin", segments=18, rings=8)

    mesh.add_capsule("left_leg", (-0.12, -0.005, 0.10), (-0.12, -0.005, 0.45), 0.075, "skin", segments=18)
    mesh.add_capsule("right_leg", (0.12, -0.005, 0.10), (0.12, -0.005, 0.45), 0.075, "skin", segments=18)
    mesh.add_ellipsoid("left_foot", (-0.12, -0.075, 0.03), (0.105, 0.075, 0.045), "skin", segments=18, rings=8)
    mesh.add_ellipsoid("right_foot", (0.12, -0.075, 0.03), (0.105, 0.075, 0.045), "skin", segments=18, rings=8)

    mesh.add_box("left_cloth_strap", (-0.17, -0.175, 0.78), (0.055, 0.035, 0.29), "white_cloth")
    mesh.add_box("right_cloth_strap", (0.17, -0.175, 0.78), (0.055, 0.035, 0.29), "white_cloth")
    mesh.add_box("left_cloth_side_shadow", (-0.27, -0.13, 0.57), (0.025, 0.03, 0.36), "cloth_shadow")
    mesh.add_box("right_cloth_side_shadow", (0.27, -0.13, 0.57), (0.025, 0.03, 0.36), "cloth_shadow")

    # Hair: assumed 4th cell on the top row, with short twin-tails and side-swept bangs.
    mesh.add_ellipsoid(
        "hair_cap",
        (0.0, 0.035, 1.61),
        (0.53, 0.43, 0.48),
        "hair",
        segments=36,
        rings=14,
        theta_min=0.0,
        theta_max=2.12,
    )
    mesh.add_ellipsoid("left_side_hair", (-0.44, -0.03, 1.42), (0.12, 0.11, 0.31), "hair", segments=24, rings=12, transform=rot_z(-8))
    mesh.add_ellipsoid("right_side_hair", (0.44, -0.03, 1.42), (0.12, 0.11, 0.31), "hair", segments=24, rings=12, transform=rot_z(8))

    bang_specs = [
        ("bang_left_sweep", (-0.19, -0.405, 1.72), (0.075, 0.045, 0.26), -31),
        ("bang_center", (0.02, -0.418, 1.72), (0.065, 0.045, 0.25), 5),
        ("bang_right_short", (0.20, -0.405, 1.70), (0.06, 0.04, 0.19), 22),
        ("bang_left_edge", (-0.34, -0.36, 1.58), (0.065, 0.05, 0.22), -8),
        ("bang_right_edge", (0.35, -0.36, 1.56), (0.065, 0.05, 0.20), 8),
    ]
    for name, center, radii, angle in bang_specs:
        mesh.add_ellipsoid(name, center, radii, "hair", segments=22, rings=10, transform=rot_y(angle))

    mesh.add_ellipsoid("left_tie", (-0.52, 0.005, 1.18), (0.085, 0.075, 0.075), "hair_band", segments=18, rings=8)
    mesh.add_ellipsoid("right_tie", (0.52, 0.005, 1.18), (0.085, 0.075, 0.075), "hair_band", segments=18, rings=8)
    mesh.add_ellipsoid("left_tail_upper", (-0.67, 0.035, 1.09), (0.18, 0.13, 0.23), "hair", segments=26, rings=12, transform=rot_z(-15))
    mesh.add_ellipsoid("left_tail_lower", (-0.72, 0.02, 0.88), (0.145, 0.11, 0.19), "hair", segments=24, rings=10, transform=rot_z(13))
    mesh.add_ellipsoid("right_tail_upper", (0.67, 0.035, 1.09), (0.18, 0.13, 0.23), "hair", segments=26, rings=12, transform=rot_z(15))
    mesh.add_ellipsoid("right_tail_lower", (0.72, 0.02, 0.88), (0.145, 0.11, 0.19), "hair", segments=24, rings=10, transform=rot_z(-13))
    mesh.add_ellipsoid("left_tail_tip_shadow", (-0.76, -0.005, 0.75), (0.08, 0.06, 0.08), "hair_shadow", segments=18, rings=8)
    mesh.add_ellipsoid("right_tail_tip_shadow", (0.76, -0.005, 0.75), (0.08, 0.06, 0.08), "hair_shadow", segments=18, rings=8)

    for x, z, angle in [(-0.24, 1.87, -28), (-0.05, 1.91, -12), (0.16, 1.88, 18), (0.33, 1.74, 25)]:
        mesh.add_ellipsoid(
            f"hair_highlight_{x}_{z}",
            (x, -0.415, z),
            (0.018, 0.018, 0.105),
            "hair_highlight",
            segments=12,
            rings=6,
            transform=rot_y(angle),
        )

    for side, x in [("left", -0.18), ("right", 0.18)]:
        mesh.add_flat_ellipse(f"{side}_eye_dark", (x, -0.392, 1.49), 0.072, 0.105, "eye_dark")
        mesh.add_flat_ellipse(f"{side}_eye_blue", (x, -0.397, 1.475), 0.054, 0.080, "eye_blue")
        mesh.add_flat_ellipse(f"{side}_eye_light", (x - 0.026, -0.403, 1.525), 0.018, 0.026, "eye_light", segments=14)
        mesh.add_flat_ellipse(f"{side}_eye_small_light", (x + 0.024, -0.404, 1.43), 0.011, 0.015, "eye_light", segments=12)

    mesh.add_box("mouth", (0.0, -0.404, 1.265), (0.075, 0.010, 0.014), "mouth")
    return mesh


def shade_color(material: str, normal: np.ndarray, view: str) -> tuple[int, int, int]:
    base = np.array(MATERIALS[material])
    light = np.array([-0.45, -0.65, 0.70]) if view == "front" else np.array([-0.45, 0.35, 0.82])
    light = light / np.linalg.norm(light)
    n = normal / (np.linalg.norm(normal) + 1e-8)
    shade = 0.72 + 0.28 * max(0.0, float(np.dot(n, light)))
    rgb = np.clip(base * shade * 255, 0, 255).astype(int)
    return tuple(int(v) for v in rgb)


def render_view(mesh: Mesh, view: str, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGBA", size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(canvas)

    verts = np.array(mesh.vertices)
    margin = 52
    if view == "front":
        pts = np.stack([verts[:, 0], verts[:, 2]], axis=1)
        depth = verts[:, 1]
    elif view == "side":
        pts = np.stack([verts[:, 1], verts[:, 2]], axis=1)
        depth = -verts[:, 0]
    else:
        raise ValueError(view)

    min_xy = pts.min(axis=0)
    max_xy = pts.max(axis=0)
    scale = min((width - margin * 2) / (max_xy[0] - min_xy[0]), (height - margin * 2) / (max_xy[1] - min_xy[1]))
    offset = np.array(
        [
            (width - (min_xy[0] + max_xy[0]) * scale) / 2,
            height - margin + min_xy[1] * scale,
        ]
    )

    face_items = []
    for group, material, face in mesh.faces:
        idx = [i - 1 for i in face]
        face_verts = verts[idx]
        if len(face_verts) >= 3:
            normal = np.cross(face_verts[1] - face_verts[0], face_verts[2] - face_verts[0])
        else:
            normal = np.array([0.0, 0.0, 1.0])
        face_depth = float(depth[idx].mean())
        projected = pts[idx] * scale
        projected = np.column_stack([projected[:, 0] + offset[0], offset[1] - projected[:, 1]])
        area = 0.0
        for i in range(len(projected)):
            x1, y1 = projected[i]
            x2, y2 = projected[(i + 1) % len(projected)]
            area += x1 * y2 - x2 * y1
        if abs(area) < 1.0:
            continue
        face_items.append((face_depth, material, normal, projected))

    # Draw far to near for a simple orthographic preview.
    reverse = view == "front"
    face_items.sort(key=lambda item: item[0], reverse=reverse)
    for _, material, normal, projected in face_items:
        color = shade_color(material, normal, view)
        draw.polygon([tuple(p) for p in projected], fill=color + (255,))

    return canvas


def crop_reference() -> Image.Image | None:
    if not REFERENCE_IMAGE.exists():
        return None
    image = Image.open(REFERENCE_IMAGE).convert("RGBA")
    cell_w = image.width // 4
    cell_h = image.height // 2
    # Assumption: "4-4" means the 4th hairstyle in the visible row grid, top-right cell.
    crop = image.crop((cell_w * 3, 0, cell_w * 4, cell_h))
    crop.save(REFERENCE_CROP_PATH)
    return crop


def compose_preview(mesh: Mesh) -> None:
    reference = crop_reference()
    front = render_view(mesh, "front", (430, 620))
    side = render_view(mesh, "side", (330, 620))

    canvas = Image.new("RGBA", (1180, 700), (246, 248, 250, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font_title = ImageFont.truetype("arial.ttf", 22)
        font_small = ImageFont.truetype("arial.ttf", 15)
    except OSError:
        font_title = ImageFont.load_default()
        font_small = ImageFont.load_default()

    draw.text((32, 26), "2-head chibi blockout - assumed 4th hairstyle reference", fill=(25, 30, 35), font=font_title)

    if reference is not None:
        ref = Image.new("RGB", (300, 400), (0, 255, 0))
        src = reference.copy()
        src.thumbnail((300, 400), Image.Resampling.LANCZOS)
        ref.paste(src.convert("RGB"), ((300 - src.width) // 2, (400 - src.height) // 2))
        canvas.paste(ref.convert("RGBA"), (40, 110))
        draw.text((40, 525), "reference crop", fill=(65, 70, 75), font=font_small)

    canvas.alpha_composite(front, (395, 65))
    canvas.alpha_composite(side, (805, 65))
    draw.text((510, 645), "front", fill=(65, 70, 75), font=font_small)
    draw.text((930, 645), "side", fill=(65, 70, 75), font=font_small)

    guide_x = 735
    top_z = 1.97
    chin_z = 0.97
    foot_z = 0.0
    view_height = 620
    margin = 52
    min_z, max_z = -0.02, 2.05
    scale = (view_height - margin * 2) / (max_z - min_z)
    base_y = 65 + view_height - margin + min_z * scale
    for label, z in [("head 1.0", top_z), ("chin", chin_z), ("body 1.0", foot_z)]:
        y = base_y - z * scale
        draw.line((guide_x, y, guide_x + 72, y), fill=(88, 96, 105), width=2)
        draw.text((guide_x + 78, y - 8), label, fill=(88, 96, 105), font=font_small)

    canvas.convert("RGB").save(PREVIEW_PATH)


def write_proportions() -> None:
    data = {
        "unit": "1.0 = head height, excluding extra hair volume",
        "overall_ratio": "2-head chibi",
        "height": {
            "feet_bottom_z": 0.0,
            "chin_z": 0.97,
            "head_top_z": 1.97,
            "hair_top_z": 2.09,
        },
        "body": {
            "shoulder_width": 0.64,
            "torso_width": 0.58,
            "arm_length": 0.42,
            "leg_length": 0.45,
        },
        "head": {
            "width": 0.94,
            "depth": 0.78,
            "height": 1.0,
            "eye_line_z": 1.49,
        },
        "hair_reference": {
            "source": str(REFERENCE_IMAGE),
            "assumption": "top row, 4th cell of the provided 4x2 sprite sheet",
            "features": [
                "taupe-brown bob cap",
                "side-swept bangs",
                "short twin tails tied near the ears",
            ],
        },
        "intended_use": [
            "proportion anchor for image generation",
            "rough Blender import blockout",
            "front/side silhouette review before detailed modeling",
        ],
    }
    PROPORTIONS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    mesh = build_model()
    write_mtl(MTL_PATH)
    mesh.write_obj(OBJ_PATH, MTL_PATH.name)
    write_proportions()
    compose_preview(mesh)
    print(f"Wrote {OBJ_PATH}")
    print(f"Wrote {MTL_PATH}")
    print(f"Wrote {PROPORTIONS_PATH}")
    print(f"Wrote {PREVIEW_PATH}")
    if REFERENCE_CROP_PATH.exists():
        print(f"Wrote {REFERENCE_CROP_PATH}")


if __name__ == "__main__":
    main()
