#!/usr/bin/env python3
"""Generate RTL Hebrew PDF from markdown using WeasyPrint (HTML→PDF)."""

import markdown
import weasyprint

md_path = r"c:\Users\User\familybudget\docs\competitor-analysis-unified.md"
output_path = r"C:\Users\User\Downloads\Competitor_Analysis_My_Family_Finance.pdf"

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Convert markdown to HTML
html_body = markdown.markdown(md_content, extensions=["tables", "fenced_code"])

# Wrap in full HTML with RTL styling
html = f"""<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: A4;
    margin: 20mm 15mm 15mm 15mm;
    @bottom-center {{
      content: counter(page) " / " counter(pages);
      font-size: 9px;
      color: #999;
    }}
  }}
  body {{
    font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    text-align: right;
    font-size: 11px;
    line-height: 1.7;
    color: #222;
    background: #fff;
  }}
  h1 {{
    font-size: 24px;
    color: #1a1a2e;
    border-bottom: 3px solid #0066cc;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 15px;
  }}
  h2 {{
    font-size: 18px;
    color: #0066cc;
    border-bottom: 1px solid #ddd;
    padding-bottom: 6px;
    margin-top: 30px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }}
  h3 {{
    font-size: 14px;
    color: #333;
    margin-top: 20px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }}
  p {{
    margin-bottom: 8px;
  }}
  blockquote {{
    border-right: 4px solid #0066cc;
    padding-right: 15px;
    margin-right: 0;
    color: #555;
    font-style: italic;
    background: #f8f9fa;
    padding: 10px 15px;
    border-radius: 4px;
  }}
  ul, ol {{
    padding-right: 20px;
    padding-left: 0;
  }}
  li {{
    margin-bottom: 4px;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 9px;
    page-break-inside: auto;
  }}
  thead {{
    display: table-header-group;
  }}
  tr {{
    page-break-inside: avoid;
  }}
  th {{
    background: #1e3a5f;
    color: white;
    padding: 6px 8px;
    text-align: right;
    font-weight: bold;
    border: 1px solid #ccc;
    font-size: 9px;
  }}
  td {{
    padding: 5px 8px;
    border: 1px solid #ddd;
    text-align: right;
    font-size: 9px;
  }}
  tr:nth-child(even) td {{
    background: #f8fafc;
  }}
  hr {{
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 20px 0;
  }}
  strong {{
    color: #1a1a2e;
  }}
  code {{
    background: #f0f0f0;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 10px;
    direction: ltr;
    unicode-bidi: embed;
  }}
  a {{
    color: #0066cc;
    text-decoration: none;
  }}
  /* Cover styling */
  .cover-date {{
    color: #666;
    font-size: 12px;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

# Generate PDF
weasyprint.HTML(string=html).write_pdf(output_path)
print(f"PDF created: {output_path}")
