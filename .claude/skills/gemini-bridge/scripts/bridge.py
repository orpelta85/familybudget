#!/usr/bin/env python3
"""
Gemini Bridge — Unified CLI for Google Gemini AI tasks.
Handles image generation, text queries, research, brainstorming, and copywriting.
"""

import argparse
import os
import sys
import base64
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("ERROR: google-genai package not installed. Run: pip install google-genai")
    sys.exit(1)

API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyAInQSdIO0uHRE8Z39M_miTddZucRWgYq0')

# Models
TEXT_MODEL = 'gemini-3.1-pro-preview'
IMAGE_MODEL = 'imagen-4.0-generate-001'
FLASH_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

# Cost estimates (USD)
COST_TEXT = 0.001
COST_IMAGE_IMAGEN = 0.04
COST_IMAGE_FLASH = 0.02

client = genai.Client(api_key=API_KEY)


def save_image(image_data, output_dir, prefix, index):
    """Save image bytes to a PNG file."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}_{index + 1}_{int(time.time())}.png"
    filepath = output_path / filename
    filepath.write_bytes(image_data)
    return str(filepath)


def cmd_image(args):
    """Generate images using Imagen 4."""
    prompt = args.prompt
    count = min(args.count, 4)
    output_dir = args.output or "."
    aspect = args.size or "1:1"

    print(f"[gemini-bridge] Generating {count} image(s) with Imagen 4...")
    print(f"[gemini-bridge] Prompt: {prompt}")
    print(f"[gemini-bridge] Aspect ratio: {aspect}")

    saved_files = []
    try:
        for i in range(count):
            response = client.models.generate_images(
                model=IMAGE_MODEL,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect,
                ),
            )
            if response.generated_images:
                for img in response.generated_images:
                    filepath = save_image(img.image.image_bytes, output_dir, "image", len(saved_files))
                    saved_files.append(filepath)
                    print(f"[gemini-bridge] Saved: {filepath}")

        total_cost = len(saved_files) * COST_IMAGE_IMAGEN
        print(f"\n[gemini-bridge] Model: {IMAGE_MODEL}")
        print(f"[gemini-bridge] Generated: {len(saved_files)} image(s)")
        print(f"[gemini-bridge] Est. cost: ${total_cost:.3f}")

    except Exception as e:
        error_msg = str(e)
        print(f"[gemini-bridge] Imagen 4 failed: {error_msg}")
        print(f"[gemini-bridge] Falling back to {FLASH_IMAGE_MODEL}...")
        try:
            for i in range(count):
                response = client.models.generate_content(
                    model=FLASH_IMAGE_MODEL,
                    contents=f"Generate an image: {prompt}",
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
                if response.candidates:
                    for part in response.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                            filepath = save_image(part.inline_data.data, output_dir, "image", len(saved_files))
                            saved_files.append(filepath)
                            print(f"[gemini-bridge] Saved: {filepath}")

            total_cost = len(saved_files) * COST_IMAGE_FLASH
            print(f"\n[gemini-bridge] Model: {FLASH_IMAGE_MODEL} (fallback)")
            print(f"[gemini-bridge] Generated: {len(saved_files)} image(s)")
            print(f"[gemini-bridge] Est. cost: ${total_cost:.3f}")

        except Exception as e2:
            print(f"[gemini-bridge] Fallback also failed: {e2}")
            print("[gemini-bridge] This may be a quota issue. Monthly budget: 50 NIS (~$14).")
            sys.exit(1)


def cmd_ask(args):
    """Ask Gemini a question."""
    prompt = args.prompt
    print(f"[gemini-bridge] Asking Gemini ({TEXT_MODEL})...")

    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=prompt,
        )
        print(f"\n{response.text}")
        print(f"\n[gemini-bridge] Model: {TEXT_MODEL}")
        print(f"[gemini-bridge] Est. cost: ${COST_TEXT:.4f}")
    except Exception as e:
        print(f"[gemini-bridge] Error: {e}")
        sys.exit(1)


def cmd_research(args):
    """Research a topic using Gemini with web search grounding."""
    prompt = args.prompt
    print(f"[gemini-bridge] Researching with Gemini ({TEXT_MODEL})...")

    system_prompt = """You are a thorough research analyst. Research the following topic comprehensively:
- Provide facts, data, and statistics where available
- Cite sources when possible
- Structure the response with clear sections
- Include both current state and trends
- If the topic is about Israel/Hebrew market, include local context"""

    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=f"{system_prompt}\n\nResearch topic: {prompt}",
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        print(f"\n{response.text}")
        print(f"\n[gemini-bridge] Model: {TEXT_MODEL} (with web search)")
        print(f"[gemini-bridge] Est. cost: ${COST_TEXT * 2:.4f}")
    except Exception as e:
        print(f"[gemini-bridge] Error: {e}")
        # Retry without search tool
        print("[gemini-bridge] Retrying without web search...")
        try:
            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=f"{system_prompt}\n\nResearch topic: {prompt}",
            )
            print(f"\n{response.text}")
            print(f"\n[gemini-bridge] Model: {TEXT_MODEL} (no web search)")
            print(f"[gemini-bridge] Est. cost: ${COST_TEXT:.4f}")
        except Exception as e2:
            print(f"[gemini-bridge] Error: {e2}")
            sys.exit(1)


def cmd_brainstorm(args):
    """Brainstorm ideas using Gemini."""
    prompt = args.prompt
    print(f"[gemini-bridge] Brainstorming with Gemini ({TEXT_MODEL})...")

    system_prompt = """You are a creative brainstorming partner. Generate diverse, creative ideas:
- Think outside the box — include unexpected angles
- Mix practical and wild ideas
- Consider the Israeli/Hebrew market context if relevant
- Number each idea clearly
- For each idea, add a one-line rationale"""

    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=f"{system_prompt}\n\nBrainstorm: {prompt}",
        )
        print(f"\n{response.text}")
        print(f"\n[gemini-bridge] Model: {TEXT_MODEL}")
        print(f"[gemini-bridge] Est. cost: ${COST_TEXT:.4f}")
    except Exception as e:
        print(f"[gemini-bridge] Error: {e}")
        sys.exit(1)


def cmd_write(args):
    """Write professional copy using Gemini."""
    prompt = args.prompt
    print(f"[gemini-bridge] Writing copy with Gemini ({TEXT_MODEL})...")

    system_prompt = """You are an expert copywriter. Write professional, compelling copy:
- Match the requested tone and format
- If Hebrew is requested, write native-quality Hebrew (not translated)
- Focus on benefits over features
- Use persuasive but authentic language
- Structure with clear hierarchy (headlines, subheadlines, body)"""

    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=f"{system_prompt}\n\nWrite: {prompt}",
        )
        print(f"\n{response.text}")
        print(f"\n[gemini-bridge] Model: {TEXT_MODEL}")
        print(f"[gemini-bridge] Est. cost: ${COST_TEXT:.4f}")
    except Exception as e:
        print(f"[gemini-bridge] Error: {e}")
        sys.exit(1)


def cmd_imagine(args):
    """Generate image + text description using Gemini Flash Image."""
    prompt = args.prompt
    count = min(args.count, 4)
    output_dir = args.output or "."

    print(f"[gemini-bridge] Generating with {FLASH_IMAGE_MODEL}...")
    print(f"[gemini-bridge] Prompt: {prompt}")

    saved_files = []
    try:
        for i in range(count):
            response = client.models.generate_content(
                model=FLASH_IMAGE_MODEL,
                contents=f"Generate an image: {prompt}",
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                        filepath = save_image(part.inline_data.data, output_dir, "imagine", len(saved_files))
                        saved_files.append(filepath)
                        print(f"[gemini-bridge] Saved: {filepath}")
                    elif part.text:
                        print(f"[gemini-bridge] Description: {part.text}")

        total_cost = len(saved_files) * COST_IMAGE_FLASH
        print(f"\n[gemini-bridge] Model: {FLASH_IMAGE_MODEL}")
        print(f"[gemini-bridge] Generated: {len(saved_files)} image(s)")
        print(f"[gemini-bridge] Est. cost: ${total_cost:.3f}")

    except Exception as e:
        print(f"[gemini-bridge] Error: {e}")
        sys.exit(1)


def cmd_character(args):
    """Generate character sheet with multiple expressions."""
    base_prompt = args.prompt
    expressions = args.expressions.split(",") if args.expressions else ["happy", "sad", "angry", "surprised"]
    output_dir = args.output or "."

    print(f"[gemini-bridge] Generating character sheet...")
    print(f"[gemini-bridge] Base: {base_prompt}")
    print(f"[gemini-bridge] Expressions: {', '.join(expressions)}")

    saved_files = []
    for expr in expressions:
        full_prompt = f"{base_prompt}, expression: {expr.strip()}, character sheet style, consistent character design, white background"
        print(f"\n[gemini-bridge] Generating expression: {expr.strip()}...")

        try:
            response = client.models.generate_images(
                model=IMAGE_MODEL,
                prompt=full_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1",
                ),
            )
            if response.generated_images:
                for img in response.generated_images:
                    filepath = save_image(img.image.image_bytes, output_dir, f"char_{expr.strip()}", len(saved_files))
                    saved_files.append(filepath)
                    print(f"[gemini-bridge] Saved: {filepath}")

        except Exception as e:
            print(f"[gemini-bridge] Failed for {expr}: {e}")
            # Try fallback
            try:
                response = client.models.generate_content(
                    model=FLASH_IMAGE_MODEL,
                    contents=f"Generate an image: {full_prompt}",
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
                if response.candidates:
                    for part in response.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                            filepath = save_image(part.inline_data.data, output_dir, f"char_{expr.strip()}", len(saved_files))
                            saved_files.append(filepath)
                            print(f"[gemini-bridge] Saved (fallback): {filepath}")
            except Exception as e2:
                print(f"[gemini-bridge] Fallback also failed: {e2}")

    total_cost = len(saved_files) * COST_IMAGE_IMAGEN
    print(f"\n[gemini-bridge] Generated: {len(saved_files)} expression(s)")
    print(f"[gemini-bridge] Est. cost: ${total_cost:.3f}")


def cmd_logo(args):
    """Generate logo variations."""
    name = args.name
    description = args.description or ""
    count = min(args.count, 4)
    output_dir = args.output or "."

    styles = [
        f"Minimalist modern logo for '{name}', {description}, clean vector style, simple geometric shapes, single color on white background",
        f"Professional wordmark logo for '{name}', {description}, modern typography, clean letterforms, tech company style",
        f"Icon logo for '{name}', {description}, app icon style, bold simple shape, works at small sizes, modern SaaS aesthetic",
        f"Monogram logo for '{name}', {description}, using initials, elegant modern design, geometric construction",
    ]

    print(f"[gemini-bridge] Generating {count} logo variation(s) for '{name}'...")

    saved_files = []
    for i in range(min(count, len(styles))):
        prompt = styles[i]
        print(f"\n[gemini-bridge] Style {i + 1}: {prompt[:80]}...")

        try:
            response = client.models.generate_images(
                model=IMAGE_MODEL,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1",
                ),
            )
            if response.generated_images:
                for img in response.generated_images:
                    filepath = save_image(img.image.image_bytes, output_dir, f"logo_{i + 1}", len(saved_files))
                    saved_files.append(filepath)
                    print(f"[gemini-bridge] Saved: {filepath}")

        except Exception as e:
            print(f"[gemini-bridge] Imagen failed for style {i + 1}: {e}")
            try:
                response = client.models.generate_content(
                    model=FLASH_IMAGE_MODEL,
                    contents=f"Generate an image: {prompt}",
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
                if response.candidates:
                    for part in response.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                            filepath = save_image(part.inline_data.data, output_dir, f"logo_{i + 1}", len(saved_files))
                            saved_files.append(filepath)
                            print(f"[gemini-bridge] Saved (fallback): {filepath}")
            except Exception as e2:
                print(f"[gemini-bridge] Fallback failed: {e2}")

    total_cost = len(saved_files) * COST_IMAGE_IMAGEN
    print(f"\n[gemini-bridge] Generated: {len(saved_files)} logo(s)")
    print(f"[gemini-bridge] Est. cost: ${total_cost:.3f}")


def main():
    parser = argparse.ArgumentParser(
        description="Gemini Bridge — Unified CLI for Google Gemini AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python bridge.py image "cute owl mascot" --count 4
  python bridge.py ask "What is the average salary in Israel?"
  python bridge.py research "competitor analysis family budget apps"
  python bridge.py brainstorm "10 slogan ideas for Family Plan"
  python bridge.py write "landing page hero, Hebrew, family budget app"
  python bridge.py imagine "logo, modern, clean, dark theme" --count 2
  python bridge.py character "friendly man, Disney style" --expressions "happy,sad"
  python bridge.py logo "Family Plan" --description "family budget app" --count 4
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # image
    p_image = subparsers.add_parser("image", help="Generate images with Imagen 4")
    p_image.add_argument("prompt", help="Image description")
    p_image.add_argument("--count", type=int, default=1, help="Number of images (1-4)")
    p_image.add_argument("--size", default="1:1", help="Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)")
    p_image.add_argument("--output", default=".", help="Output directory")

    # ask
    p_ask = subparsers.add_parser("ask", help="Ask Gemini a question")
    p_ask.add_argument("prompt", help="Your question")

    # research
    p_research = subparsers.add_parser("research", help="Research a topic with web search")
    p_research.add_argument("prompt", help="Research topic")

    # brainstorm
    p_brainstorm = subparsers.add_parser("brainstorm", help="Brainstorm creative ideas")
    p_brainstorm.add_argument("prompt", help="Brainstorm topic")

    # write
    p_write = subparsers.add_parser("write", help="Write professional copy")
    p_write.add_argument("prompt", help="Copy brief")

    # imagine
    p_imagine = subparsers.add_parser("imagine", help="Generate image + text with Gemini Flash")
    p_imagine.add_argument("prompt", help="Image description")
    p_imagine.add_argument("--count", type=int, default=1, help="Number of images (1-4)")
    p_imagine.add_argument("--output", default=".", help="Output directory")

    # character
    p_char = subparsers.add_parser("character", help="Generate character sheet")
    p_char.add_argument("prompt", help="Character description")
    p_char.add_argument("--expressions", default="happy,sad,angry,surprised", help="Comma-separated expressions")
    p_char.add_argument("--output", default=".", help="Output directory")

    # logo
    p_logo = subparsers.add_parser("logo", help="Generate logo variations")
    p_logo.add_argument("name", help="Brand/product name")
    p_logo.add_argument("--description", default="", help="Brand description")
    p_logo.add_argument("--count", type=int, default=4, help="Number of variations (1-4)")
    p_logo.add_argument("--output", default=".", help="Output directory")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "image": cmd_image,
        "ask": cmd_ask,
        "research": cmd_research,
        "brainstorm": cmd_brainstorm,
        "write": cmd_write,
        "imagine": cmd_imagine,
        "character": cmd_character,
        "logo": cmd_logo,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
