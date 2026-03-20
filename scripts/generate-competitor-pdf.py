#!/usr/bin/env python3
"""Generate a professional PDF from the competitor analysis markdown."""

import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Try to register a Hebrew font
HEBREW_FONT = "Helvetica"
HEBREW_FONT_BOLD = "Helvetica-Bold"

# Try Arial which supports Hebrew on Windows
for font_path in [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]:
    if os.path.exists(font_path):
        if "arialbd" in font_path:
            pdfmetrics.registerFont(TTFont("ArialBold", font_path))
            HEBREW_FONT_BOLD = "ArialBold"
        else:
            pdfmetrics.registerFont(TTFont("Arial", font_path))
            HEBREW_FONT = "Arial"

# Colors
DARK_BG = HexColor("#1a1a2e")
ACCENT = HexColor("#0066cc")
ACCENT_GREEN = HexColor("#22c55e")
ACCENT_RED = HexColor("#ef4444")
ACCENT_ORANGE = HexColor("#f59e0b")
WHITE = HexColor("#ffffff")
LIGHT_GRAY = HexColor("#f0f0f0")
MEDIUM_GRAY = HexColor("#e0e0e0")
TABLE_HEADER_BG = HexColor("#1e3a5f")
TABLE_ALT_BG = HexColor("#f8fafc")

# Read the markdown file
md_path = r"c:\Users\User\familybudget\docs\competitor-analysis-unified.md"
with open(md_path, "r", encoding="utf-8") as f:
    content = f.read()

# Output path
output_path = r"C:\Users\User\Downloads\Competitor_Analysis_My_Family_Finance.pdf"

# Create PDF
doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    rightMargin=15*mm,
    leftMargin=15*mm,
    topMargin=20*mm,
    bottomMargin=15*mm,
)

# Styles
styles = {
    "title": ParagraphStyle(
        "Title",
        fontName=HEBREW_FONT_BOLD,
        fontSize=22,
        leading=28,
        alignment=TA_RIGHT,
        textColor=DARK_BG,
        spaceAfter=6*mm,
        wordWrap="RTL",
    ),
    "subtitle": ParagraphStyle(
        "Subtitle",
        fontName=HEBREW_FONT,
        fontSize=11,
        leading=16,
        alignment=TA_RIGHT,
        textColor=HexColor("#666666"),
        spaceAfter=8*mm,
        wordWrap="RTL",
    ),
    "h2": ParagraphStyle(
        "H2",
        fontName=HEBREW_FONT_BOLD,
        fontSize=16,
        leading=22,
        alignment=TA_RIGHT,
        textColor=ACCENT,
        spaceBefore=8*mm,
        spaceAfter=4*mm,
        wordWrap="RTL",
    ),
    "h3": ParagraphStyle(
        "H3",
        fontName=HEBREW_FONT_BOLD,
        fontSize=13,
        leading=18,
        alignment=TA_RIGHT,
        textColor=DARK_BG,
        spaceBefore=5*mm,
        spaceAfter=3*mm,
        wordWrap="RTL",
    ),
    "body": ParagraphStyle(
        "Body",
        fontName=HEBREW_FONT,
        fontSize=10,
        leading=16,
        alignment=TA_RIGHT,
        textColor=HexColor("#333333"),
        spaceAfter=2*mm,
        wordWrap="RTL",
    ),
    "bullet": ParagraphStyle(
        "Bullet",
        fontName=HEBREW_FONT,
        fontSize=10,
        leading=15,
        alignment=TA_RIGHT,
        textColor=HexColor("#333333"),
        spaceAfter=1.5*mm,
        rightIndent=5*mm,
        wordWrap="RTL",
    ),
    "quote": ParagraphStyle(
        "Quote",
        fontName=HEBREW_FONT,
        fontSize=10,
        leading=15,
        alignment=TA_RIGHT,
        textColor=HexColor("#555555"),
        leftIndent=10*mm,
        rightIndent=10*mm,
        spaceAfter=3*mm,
        wordWrap="RTL",
        borderColor=ACCENT,
        borderWidth=2,
        borderPadding=5,
    ),
}

story = []

# Parse markdown sections
lines = content.split("\n")
i = 0
while i < len(lines):
    line = lines[i].strip()

    # Skip empty lines
    if not line:
        i += 1
        continue

    # Skip horizontal rules
    if line == "---":
        story.append(HRFlowable(width="100%", thickness=0.5, color=MEDIUM_GRAY, spaceAfter=3*mm, spaceBefore=3*mm))
        i += 1
        continue

    # Title (# heading)
    if line.startswith("# ") and not line.startswith("## "):
        text = line[2:].strip()
        story.append(Paragraph(text, styles["title"]))
        i += 1
        continue

    # Blockquote (> text)
    if line.startswith("> "):
        text = line[2:].strip()
        # Remove ** bold markers
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        story.append(Paragraph(text, styles["subtitle"]))
        i += 1
        continue

    # H2 (## heading)
    if line.startswith("## "):
        text = line[3:].strip()
        story.append(Paragraph(text, styles["h2"]))
        i += 1
        continue

    # H3 (### heading)
    if line.startswith("### "):
        text = line[4:].strip()
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        story.append(Paragraph(text, styles["h3"]))
        i += 1
        continue

    # Table
    if line.startswith("|"):
        # Collect all table rows
        table_lines = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row_line = lines[i].strip()
            # Skip separator rows (|---|---|)
            if re.match(r'^\|[\s\-:]+\|', row_line):
                i += 1
                continue
            cells = [c.strip() for c in row_line.split("|")[1:-1]]
            # Clean markdown formatting
            cleaned = []
            for c in cells:
                c = re.sub(r'\*\*(.*?)\*\*', r'\1', c)
                c = re.sub(r'\*(.*?)\*', r'\1', c)
                c = c.replace("—", "-")
                cleaned.append(c)
            table_lines.append(cleaned)
            i += 1

        if table_lines:
            # Determine column count
            max_cols = max(len(row) for row in table_lines)
            # Pad rows
            for row in table_lines:
                while len(row) < max_cols:
                    row.append("")

            # Create table with Paragraphs for RTL
            table_data = []
            for ri, row in enumerate(table_lines):
                para_row = []
                for cell in row:
                    if ri == 0:
                        style = ParagraphStyle("th", fontName=HEBREW_FONT_BOLD, fontSize=8, leading=11, alignment=TA_RIGHT, textColor=WHITE, wordWrap="RTL")
                    else:
                        style = ParagraphStyle("td", fontName=HEBREW_FONT, fontSize=8, leading=11, alignment=TA_RIGHT, textColor=HexColor("#333333"), wordWrap="RTL")
                    para_row.append(Paragraph(cell, style))
                table_data.append(para_row)

            # Calculate column widths
            avail_width = A4[0] - 30*mm
            col_width = avail_width / max_cols
            col_widths = [col_width] * max_cols

            # First column wider for feature names
            if max_cols >= 3:
                col_widths[0] = avail_width * 0.3
                remaining = avail_width * 0.7
                for ci in range(1, max_cols):
                    col_widths[ci] = remaining / (max_cols - 1)

            t = Table(table_data, colWidths=col_widths, repeatRows=1)

            style_cmds = [
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), HEBREW_FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]

            # Alternating row colors
            for ri in range(1, len(table_data)):
                if ri % 2 == 0:
                    style_cmds.append(("BACKGROUND", (0, ri), (-1, ri), TABLE_ALT_BG))

            t.setStyle(TableStyle(style_cmds))
            story.append(t)
            story.append(Spacer(1, 3*mm))
        continue

    # Bullet points
    if line.startswith("- ") or line.startswith("* "):
        text = line[2:].strip()
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        text = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1', text)  # Remove links
        story.append(Paragraph("• " + text, styles["bullet"]))
        i += 1
        continue

    # Numbered list
    num_match = re.match(r'^(\d+)\.\s+(.+)', line)
    if num_match:
        num = num_match.group(1)
        text = num_match.group(2).strip()
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        text = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1', text)
        story.append(Paragraph(f"{num}. {text}", styles["bullet"]))
        i += 1
        continue

    # Regular paragraph
    text = line
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1', text)
    if text:
        story.append(Paragraph(text, styles["body"]))
    i += 1

# Build PDF
doc.build(story)
print(f"PDF created: {output_path}")
