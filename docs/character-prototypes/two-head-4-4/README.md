# Two-Head Chibi 4-4 Prototype

This is a first-pass 3D blockout for a two-head chibi character. It uses the
top-row fourth sprite in the provided reference sheet as the assumed hairstyle:
taupe-brown short hair, side-swept bangs, and short twin tails.

## Files

- `chibi_two_head_4_4.obj` - importable model geometry.
- `chibi_two_head_4_4.mtl` - simple material colors for skin, hair, eyes, and clothing.
- `preview_front_side.png` - quick visual check with the reference crop, front view, and side view.
- `reference_4_4_assumed_crop.png` - the assumed hairstyle crop from the supplied image.
- `proportions.json` - head/body measurements and modeling notes.
- `make_model.py` - deterministic generator for this prototype.

## Proportion Rule

- Head height: `1.0`
- Body height from feet to chin: `1.0`
- Total base character height: `2.0`
- Hair and tail volume may extend outside the base height.

The goal is not final beauty yet. The goal is a stable proportion anchor that can
be posed, rendered, and used as a ControlNet/depth/reference source for AI image
generation.
