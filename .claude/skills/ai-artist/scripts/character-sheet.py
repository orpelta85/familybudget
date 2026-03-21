#!/usr/bin/env python3
"""
Character Sheet Generator — creates a character in multiple expressions using Google Gemini.

Usage:
    python character-sheet.py --character "owl with glasses" --style "disney" --output-dir "./output"
    python character-sheet.py --character "friendly robot" --style "pixar" --expressions "happy,sad,angry,surprised"

Generates images of the same character with different expressions/poses.
Default expressions: normal, happy, worried, sleeping, celebrating

Requires: GEMINI_API_KEY environment variable
"""

import argparse
import os
import sys
from pathlib import Path

# Import from sibling generate module
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    STYLE_PRESETS,
    VALID_ASPECT_RATIOS,
    build_prompt,
    generate_image_imagen,
    generate_image_gemini_flash,
    save_image,
    ENGINE_IMAGEN,
    ENGINE_GEMINI_FLASH,
)

from google import genai

DEFAULT_EXPRESSIONS = [
    ("normal", "neutral expression, standing confidently, default pose"),
    ("happy", "very happy, big smile, joyful, celebrating with excitement"),
    ("worried", "worried expression, nervous, slightly anxious, biting lip"),
    ("sleeping", "sleeping peacefully, eyes closed, relaxed, ZZZ"),
    ("celebrating", "celebrating a victory, arms up, confetti, party mood"),
]


def main():
    parser = argparse.ArgumentParser(description="Generate character expression sheet")
    parser.add_argument("--character", required=True, help="Character description")
    parser.add_argument("--style", choices=list(STYLE_PRESETS.keys()), default=None,
                        help="Style preset")
    parser.add_argument("--size", choices=VALID_ASPECT_RATIOS, default="1:1",
                        help="Aspect ratio")
    parser.add_argument("--engine", choices=[ENGINE_IMAGEN, ENGINE_GEMINI_FLASH], default=ENGINE_IMAGEN,
                        help="Generation engine")
    parser.add_argument("--output-dir", default="./character-sheet", help="Output directory")
    parser.add_argument("--expressions", default=None,
                        help="Comma-separated list of expressions (overrides defaults)")

    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.expressions:
        expressions = [(e.strip(), e.strip()) for e in args.expressions.split(",")]
    else:
        expressions = DEFAULT_EXPRESSIONS

    # Build a consistent character reference prompt
    char_base = (
        f"A single character: {args.character}. "
        "Keep the character design EXACTLY consistent across all images — "
        "same proportions, same colors, same outfit, same features."
    )

    print(f"Engine: {args.engine}")
    print(f"Character: {args.character}")
    print(f"Style: {args.style or 'none'}")
    print(f"Expressions: {len(expressions)}")
    print(f"Output: {out_dir.resolve()}")
    print()

    generated_files = []

    for name, description in expressions:
        prompt = f"{char_base} Expression/pose: {description}. White or transparent background."
        full_prompt = build_prompt(prompt, args.style)

        print(f"[{name}] Generating...")

        if args.engine == ENGINE_IMAGEN:
            image_bytes_list = generate_image_imagen(client, full_prompt, args.size, 1)
        else:
            image_bytes_list = generate_image_gemini_flash(client, full_prompt)

        if image_bytes_list:
            out_path = out_dir / f"{name}.png"
            saved = save_image(image_bytes_list[0], out_path)
            generated_files.append(str(saved.resolve()))
            print(f"[{name}] Saved: {saved.resolve()}")
        else:
            print(f"[{name}] WARNING: No image generated")
        print()

    print("--- CHARACTER SHEET ---")
    for f in generated_files:
        print(f)


if __name__ == "__main__":
    main()
