#!/usr/bin/env python3
"""
AI Image Generator using Google Gemini (Imagen 3)

Usage:
    python generate.py --prompt "cute owl mascot" --style "disney" --size "1024x1024" --output "output.png"
    python generate.py --prompt "mountain landscape" --count 3 --output-dir "./results"
    python generate.py --prompt "logo design" --engine gemini-flash --output "logo.png"

Requires: GEMINI_API_KEY environment variable
"""

import argparse
import os
import sys
import base64
from pathlib import Path

from google import genai
from google.genai import types

STYLE_PRESETS = {
    "disney": "Disney 2D animation style, hand-drawn, warm colors, expressive, cel-shaded, clean lines",
    "pixar": "Pixar-style 3D render, soft lighting, subsurface scattering, cute, appealing",
    "flat": "flat vector illustration, minimal, geometric, clean, SVG-ready, solid colors",
    "kawaii": "kawaii style, chibi, cute, pastel colors, rounded shapes",
    "corporate": "professional corporate illustration, clean, modern, business",
    "logo": "minimal logo design, scalable, iconic, clean background",
    "icon": "app icon style, simple, recognizable, bold colors",
    "realistic": "photorealistic, detailed, high quality, natural lighting",
    "watercolor": "watercolor painting style, soft edges, paper texture, artistic",
    "mascot": "friendly mascot character, approachable, memorable, brand-suitable",
}

# Imagen 3 aspect ratios
VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"]

# Engines
ENGINE_IMAGEN = "imagen"
ENGINE_GEMINI_FLASH = "gemini-flash"


def build_prompt(prompt: str, style: str | None) -> str:
    """Combine user prompt with style preset."""
    if style and style in STYLE_PRESETS:
        return f"{prompt}. Style: {STYLE_PRESETS[style]}"
    elif style:
        return f"{prompt}. Style: {style}"
    return prompt


def generate_image_imagen(
    client: genai.Client,
    prompt: str,
    aspect_ratio: str = "1:1",
    count: int = 1,
) -> list[bytes]:
    """Generate images using Imagen 3. Returns list of image bytes."""
    response = client.models.generate_images(
        model="imagen-3.0-generate-002",
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=count,
            aspect_ratio=aspect_ratio,
        ),
    )
    results = []
    for img in response.generated_images:
        results.append(img.image.image_bytes)
    return results


def generate_image_gemini_flash(
    client: genai.Client,
    prompt: str,
) -> list[bytes]:
    """Generate image using Gemini 2.0 Flash. Returns list of image bytes."""
    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=f"Generate an image: {prompt}",
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )
    results = []
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            results.append(part.inline_data.data)
    return results


def save_image(image_bytes: bytes, output_path: Path) -> Path:
    """Save image bytes to local file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(image_bytes)
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate images with Google Gemini / Imagen 3")
    parser.add_argument("--prompt", required=True, help="Image description")
    parser.add_argument("--style", choices=list(STYLE_PRESETS.keys()), default=None,
                        help=f"Style preset: {', '.join(STYLE_PRESETS.keys())}")
    parser.add_argument("--size", choices=VALID_ASPECT_RATIOS, default="1:1",
                        help="Aspect ratio (Imagen 3)")
    parser.add_argument("--engine", choices=[ENGINE_IMAGEN, ENGINE_GEMINI_FLASH], default=ENGINE_IMAGEN,
                        help="Generation engine: imagen (Imagen 3) or gemini-flash (Gemini 2.0 Flash)")
    parser.add_argument("--count", type=int, choices=range(1, 5), default=1,
                        help="Number of images (1-4, only for Imagen engine)")
    parser.add_argument("--output", default=None,
                        help="Output file path (for single image) or ignored if --count > 1")
    parser.add_argument("--output-dir", default=".",
                        help="Output directory (used when count > 1)")

    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    full_prompt = build_prompt(args.prompt, args.style)

    print(f"Engine: {args.engine}")
    print(f"Prompt: {full_prompt}")
    print(f"Aspect ratio: {args.size} | Count: {args.count}")
    print()

    generated_files = []

    if args.engine == ENGINE_IMAGEN:
        print(f"Generating {args.count} image(s) with Imagen 3...")
        image_bytes_list = generate_image_imagen(client, full_prompt, args.size, args.count)
    else:
        print("Generating with Gemini 2.0 Flash...")
        image_bytes_list = generate_image_gemini_flash(client, full_prompt)

    for i, img_bytes in enumerate(image_bytes_list):
        if len(image_bytes_list) == 1 and args.output:
            out_path = Path(args.output)
        else:
            stem = args.prompt[:40].replace(" ", "_").replace("/", "-")
            out_path = Path(args.output_dir) / f"{stem}_{i + 1}.png"

        saved = save_image(img_bytes, out_path)
        generated_files.append(str(saved.resolve()))
        print(f"[{i + 1}/{len(image_bytes_list)}] Saved: {saved.resolve()}")

    print()
    print("--- GENERATED FILES ---")
    for f in generated_files:
        print(f)


if __name__ == "__main__":
    main()
