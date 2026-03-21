#!/usr/bin/env python3
"""
Logo Generator — creates multiple logo variations for a brand using Google Gemini.

Usage:
    python logo.py --brand "Kaspon" --description "family finance app" --style "modern" --output-dir "./output"
    python logo.py --brand "PawPal" --description "pet care startup" --count 6

Generates logo variations with different approaches (icon, wordmark, combination, abstract).

Requires: GEMINI_API_KEY environment variable
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    VALID_ASPECT_RATIOS,
    generate_image_imagen,
    generate_image_gemini_flash,
    save_image,
    ENGINE_IMAGEN,
    ENGINE_GEMINI_FLASH,
)

from google import genai

LOGO_VARIATIONS = [
    ("icon", "Minimal icon/symbol logo, no text, single iconic shape, clean white background, scalable, professional"),
    ("wordmark", "Wordmark/logotype logo, stylized text of the brand name, clean typography, white background, no icon"),
    ("combination", "Combination logo with both an icon and the brand name text, balanced layout, white background"),
    ("abstract", "Abstract geometric logo mark, modern, unique shape, minimalist, white background, memorable"),
]

LOGO_STYLES = {
    "modern": "modern, clean lines, geometric, sans-serif, tech-forward",
    "playful": "playful, rounded shapes, friendly colors, approachable, fun",
    "elegant": "elegant, refined, thin lines, sophisticated, premium feel",
    "bold": "bold, strong, high contrast, impactful, confident",
    "minimal": "ultra-minimal, simple, one or two colors max, whitespace",
    "vintage": "vintage, retro, classic feel, nostalgic, warm tones",
}


def main():
    parser = argparse.ArgumentParser(description="Generate logo variations")
    parser.add_argument("--brand", required=True, help="Brand/company name")
    parser.add_argument("--description", required=True, help="What the brand does")
    parser.add_argument("--style", choices=list(LOGO_STYLES.keys()), default="modern",
                        help="Logo style")
    parser.add_argument("--size", choices=VALID_ASPECT_RATIOS, default="1:1",
                        help="Aspect ratio")
    parser.add_argument("--engine", choices=[ENGINE_IMAGEN, ENGINE_GEMINI_FLASH], default=ENGINE_IMAGEN,
                        help="Generation engine")
    parser.add_argument("--count", type=int, default=4,
                        help="Number of variations (default 4, cycles through variation types)")
    parser.add_argument("--output-dir", default="./logos", help="Output directory")

    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    style_desc = LOGO_STYLES.get(args.style, args.style)

    print(f"Engine: {args.engine}")
    print(f"Brand: {args.brand}")
    print(f"Description: {args.description}")
    print(f"Style: {args.style} — {style_desc}")
    print(f"Variations: {args.count}")
    print(f"Output: {out_dir.resolve()}")
    print()

    generated_files = []

    for i in range(args.count):
        var_name, var_desc = LOGO_VARIATIONS[i % len(LOGO_VARIATIONS)]
        label = f"{var_name}_{i // len(LOGO_VARIATIONS) + 1}" if args.count > len(LOGO_VARIATIONS) else var_name

        prompt = (
            f"Professional logo design for \"{args.brand}\", a {args.description}. "
            f"Type: {var_desc}. "
            f"Style: {style_desc}. "
            "Vector-quality, suitable for print and digital use. "
            "Clean white background, high contrast."
        )

        print(f"[{label}] Generating...")

        if args.engine == ENGINE_IMAGEN:
            image_bytes_list = generate_image_imagen(client, prompt, args.size, 1)
        else:
            image_bytes_list = generate_image_gemini_flash(client, prompt)

        if image_bytes_list:
            out_path = out_dir / f"{args.brand.lower().replace(' ', '_')}_{label}.png"
            saved = save_image(image_bytes_list[0], out_path)
            generated_files.append(str(saved.resolve()))
            print(f"[{label}] Saved: {saved.resolve()}")
        else:
            print(f"[{label}] WARNING: No image generated")
        print()

    print("--- LOGO VARIATIONS ---")
    for f in generated_files:
        print(f)


if __name__ == "__main__":
    main()
