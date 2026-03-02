import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet


def build_styles():
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    styles = getSampleStyleSheet()
    styles["Title"].fontName = "STSong-Light"
    styles["Title"].fontSize = 18
    styles["Title"].leading = 24
    styles["Title"].textColor = colors.black
    styles["Title"].spaceAfter = 8
    styles.add(
        ParagraphStyle(
            name="ReportBody",
            parent=styles["BodyText"],
            fontName="STSong-Light",
            fontSize=11,
            leading=16,
            textColor=colors.black,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportHeading",
            parent=styles["Heading2"],
            fontName="STSong-Light",
            fontSize=14,
            leading=18,
            textColor=colors.black,
            spaceAfter=10,
        )
    )
    return styles


def build_pdf(payload, output_path):
    styles = build_styles()
    story = []

    story.append(Paragraph("Reference Verification Report", styles["Title"]))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"Report ID: {payload['reportId']}", styles["ReportBody"]))
    story.append(Paragraph(f"Generated At: {payload['createdAt']}", styles["ReportBody"]))
    story.append(
        Paragraph(
            f"Task Summary: {payload['taskSummary']['targetWordCount']} words, {payload['taskSummary']['citationStyle']}",
            styles["ReportBody"],
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Per-Reference Results", styles["ReportHeading"]))

    table_rows = [["Reference", "Verdict", "Reasoning"]]
    for entry in payload["entries"]:
        table_rows.append(
            [entry["rawReference"], entry["verdictLabel"], entry["reasoning"]]
        )

    table = Table(table_rows, colWidths=[70 * mm, 25 * mm, 75 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ece6da")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#b5ac9a")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEADING", (0, 0), (-1, -1), 14),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Closing Summary", styles["ReportHeading"]))
    story.append(Paragraph(payload["closingSummary"], styles["ReportBody"]))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
    )
    document.build(story)


def build_sample_payload():
    return {
        "taskId": "sample",
        "reportId": "REF-SAMPLE",
        "createdAt": "2026-03-02T10:00:00.000Z",
        "taskSummary": {"targetWordCount": 2000, "citationStyle": "APA 7"},
        "entries": [
            {
                "rawReference": "Smith, A. (2024). Sample source.",
                "verdictLabel": "基本可对应",
                "reasoning": "Title and available metadata align.",
            }
        ],
        "closingSummary": "This sample report confirms the PDF export pipeline is working.",
    }


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--sample":
        output_path = Path("output/pdf/sample-reference-report.pdf")
        build_pdf(build_sample_payload(), output_path)
        print(output_path)
        return

    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: export_reference_report.py <payload.json> <output.pdf>"
        )

    payload_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    build_pdf(payload, output_path)
    print(output_path)


if __name__ == "__main__":
    main()
