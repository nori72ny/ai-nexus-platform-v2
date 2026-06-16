/**
 * PDF Exporter
 * レポートをPDFファイルとして出力
 */

import { PDFDocument, PDFPage, rgb } from "pdf-lib";

export interface ReportContent {
  title: string;
  conclusion: string;
  reason: string;
  benefits: string;
  drawbacks: string;
  risks: string;
  recommendations: string;
  sources: string;
  graphs?: string;
  aiServices?: string[];
  agreement?: number;
  generatedAt?: Date;
}

/**
 * テキストを指定された幅で折り返す
 */
function wrapText(text: string, maxWidth: number, charPerLine: number = 80): string[] {
  const lines: string[] = [];
  const words = text.split(" ");
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + word).length > charPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }

  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

/**
 * PDFドキュメントを作成
 */
export async function generateReportPDF(report: ReportContent): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  // ページサイズ: A4 (210mm x 297mm = 595pt x 842pt)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // カラー定義
  const titleColor = rgb(0.2, 0.3, 0.5); // 濃いブルー
  const sectionColor = rgb(0.3, 0.4, 0.6); // セクションタイトル用
  const textColor = rgb(0.2, 0.2, 0.2); // 本文テキスト

  // ページ1: タイトルページ
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin - 50;

  page.drawText(report.title, {
    x: margin,
    y: yPosition,
    size: 28,
    color: titleColor,
    maxWidth: contentWidth,
  });

  yPosition -= 60;

  if (report.generatedAt) {
    page.drawText(`Generated: ${report.generatedAt.toLocaleString()}`, {
      x: margin,
      y: yPosition,
      size: 10,
      color: textColor,
    });
    yPosition -= 20;
  }

  if (report.aiServices && report.aiServices.length > 0) {
    page.drawText(`AI Services: ${report.aiServices.join(", ")}`, {
      x: margin,
      y: yPosition,
      size: 10,
      color: textColor,
      maxWidth: contentWidth,
    });
    yPosition -= 20;
  }

  if (report.agreement !== undefined) {
    page.drawText(`Agreement Level: ${report.agreement}%`, {
      x: margin,
      y: yPosition,
      size: 10,
      color: textColor,
    });
    yPosition -= 40;
  }

  // ページ2以降: セクションコンテンツ
  const sections = [
    { title: "結論", content: report.conclusion },
    { title: "今やるべき理由", content: report.reason },
    { title: "メリット", content: report.benefits },
    { title: "デメリット", content: report.drawbacks },
    { title: "リスク", content: report.risks },
    { title: "推奨アクション", content: report.recommendations },
    { title: "出典", content: report.sources },
  ];

  for (const section of sections) {
    // セクションタイトル
    if (yPosition < margin + 100) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }

    page.drawText(section.title, {
      x: margin,
      y: yPosition,
      size: 14,
      color: sectionColor,
      maxWidth: contentWidth,
    });

    yPosition -= 25;

    // セクションコンテンツ
    const lines = wrapText(section.content, 80);
    for (const line of lines) {
      if (yPosition < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }

      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 10,
        color: textColor,
        maxWidth: contentWidth,
      });

      yPosition -= 15;
    }

    yPosition -= 10;
  }

  // PDFをバッファに変換
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * シンプルなPDF生成（テキストのみ）
 */
export async function generateSimplePDF(title: string, content: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);

  const margin = 40;
  const contentWidth = 595 - margin * 2;

  // タイトル
  page.drawText(title, {
    x: margin,
    y: 800,
    size: 20,
    color: rgb(0.2, 0.3, 0.5),
    maxWidth: contentWidth,
  });

  // コンテンツ
  const lines = wrapText(content, 80);
  let yPosition = 760;

  for (const line of lines) {
    if (yPosition < margin + 20) {
      break; // ページオーバーフロー時は省略
    }

    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: 10,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: contentWidth,
    });

    yPosition -= 15;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
