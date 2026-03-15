/**
 * Извлечение заголовков (строк текста) из PDF через pdfjs-dist.
 * Строки определяются по вертикальной позиции (transform) элементов текста.
 */
import * as pdfjsLib from 'pdfjs-dist';

const publicUrl = process.env.PUBLIC_URL || '';
pdfjsLib.GlobalWorkerOptions.workerSrc = `${publicUrl}/pdf.worker.min.mjs`;

/**
 * Извлекает строки текста из PDF (каждая строка — потенциальный заголовок).
 * @param {File} file — файл PDF
 * @returns {Promise<string[]>} массив непустых строк в порядке сверху вниз
 */
export async function extractHeadingsFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const allLines = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items || [];

    // Группируем по вертикали (y): transform[5] — вертикальная позиция (снизу вверх в PDF)
    const byY = new Map();
    for (const item of items) {
      const str = item.str;
      if (str == null) continue;
      const y = item.transform ? item.transform[5] : 0;
      const key = Math.round(y / 3) * 3;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push(str);
    }

    // Сортируем по y по убыванию (сверху вниз на странице)
    const sortedKeys = [...byY.keys()].sort((a, b) => b - a);
    for (const key of sortedKeys) {
      const parts = byY.get(key);
      const line = (parts || []).join(' ').trim();
      if (line) allLines.push(line);
    }
  }

  return allLines;
}
