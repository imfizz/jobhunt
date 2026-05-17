import PDFDocument from 'pdfkit';
import { RESUME } from './resume';
import type { TailoredResumeData } from './claude';

const MARGIN = 50;
const FONT_BOLD = 'Helvetica-Bold';
const FONT_REG = 'Helvetica';
const COLOR_BLACK = '#1a1a1a';
const COLOR_GRAY = '#555555';
const COLOR_RULE = '#cccccc';

export function generateResumePdf(data: TailoredResumeData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const contentW = pageW - MARGIN * 2;

    // ── Header ────────────────────────────────────────────────
    doc.font(FONT_BOLD).fontSize(22).fillColor(COLOR_BLACK)
      .text(RESUME.name, MARGIN, MARGIN, { align: 'center', width: contentW });

    doc.font(FONT_REG).fontSize(10).fillColor(COLOR_GRAY)
      .text(
        `${RESUME.phone} | ${RESUME.website} | ${RESUME.location}`,
        { align: 'center', width: contentW }
      );

    doc.moveDown(0.8);

    // ── Helpers ───────────────────────────────────────────────
    function rule() {
      const y = doc.y;
      doc.moveTo(MARGIN, y)
        .lineTo(pageW - MARGIN, y)
        .strokeColor(COLOR_RULE)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.4);
    }

    function sectionHeader(title: string) {
      doc.moveDown(0.5);
      doc.font(FONT_BOLD).fontSize(13).fillColor(COLOR_BLACK)
        .text(title.toUpperCase(), { width: contentW });
      rule();
    }

    // Renders a two-column line: bold left + regular left, plain right (gray)
    function twoColumnLine(boldLeft: string, regularLeft: string, right: string) {
      const y = doc.y;
      const rightW = doc.font(FONT_REG).fontSize(10).widthOfString(right);
      const rightX = pageW - MARGIN - rightW;
      const leftW = rightX - MARGIN - 6;

      doc.font(FONT_REG).fontSize(10).fillColor(COLOR_GRAY)
        .text(right, rightX, y, { lineBreak: false });

      doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_BLACK)
        .text(boldLeft, MARGIN, y, { continued: true, width: leftW });
      doc.font(FONT_REG).fontSize(10).fillColor(COLOR_BLACK)
        .text(regularLeft, { width: leftW });
    }

    // Renders • Bold Label: regular description
    function bullet(label: string, description: string) {
      const y = doc.y;
      const indentX = MARGIN + 14;
      const bulletW = contentW - 14;

      doc.font(FONT_REG).fontSize(10).fillColor(COLOR_BLACK)
        .text('•', MARGIN + 2, y, { lineBreak: false });

      const labelStr = label ? `${label}: ` : '';
      doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_BLACK)
        .text(labelStr, indentX, y, { continued: !!description, width: bulletW });

      if (description) {
        doc.font(FONT_REG).fontSize(10).fillColor(COLOR_BLACK)
          .text(description, { width: bulletW, lineGap: 1 });
      }

      doc.moveDown(0.15);
    }

    // ── Summary ───────────────────────────────────────────────
    sectionHeader('Summary');
    doc.font(FONT_REG).fontSize(10).fillColor(COLOR_BLACK)
      .text(data.summary || RESUME.summary, { width: contentW, lineGap: 2 });

    // ── Work Experience ───────────────────────────────────────
    sectionHeader('Work Experience');

    for (const job of data.experience || []) {
      twoColumnLine(`${job.title},`, ` ${job.company} | ${job.location}`, job.period);
      doc.moveDown(0.25);

      if (job.summary) {
        doc.font(FONT_REG).fontSize(10).fillColor(COLOR_GRAY)
          .text(job.summary, { width: contentW, lineGap: 1 });
        doc.moveDown(0.25);
      }

      for (const h of job.highlights || []) {
        bullet(h.label, h.description);
      }

      doc.moveDown(0.4);
    }

    // ── Education ─────────────────────────────────────────────
    sectionHeader('Education');
    const edu = RESUME.education;
    twoColumnLine(
      `${edu.school}`,
      ` – ${edu.degree} | ${edu.location}`,
      edu.graduated
    );

    // ── Technical Skills ──────────────────────────────────────
    sectionHeader('Technical Skills');
    doc.font(FONT_REG).fontSize(10).fillColor(COLOR_BLACK)
      .text(data.skills || '', { width: contentW, lineGap: 2 });

    doc.end();
  });
}
