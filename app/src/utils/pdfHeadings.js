/**
 * Извлечение заголовков (строк текста) из PDF через pdfjs-dist.
 * Строки определяются по вертикальной позиции (transform) элементов текста.
 */
import * as pdfjsLib from 'pdfjs-dist';

const publicUrl = process.env.PUBLIC_URL || '';
pdfjsLib.GlobalWorkerOptions.workerSrc = `${publicUrl}/pdf.worker.min.mjs`;

/**
 * Проверяет, что строка похожа на нумерованный заголовок раздела: "1. Болтовня интро", "2. Задача № 1" и т.д.
 * Берём только строки вида "N. ..." (число, точка, пробел, название), не длинный body-текст.
 */
const NUMBERED_HEADING_REGEX = /^\d+\.\s+.+/;
const MAX_HEADING_LENGTH = 200;

function isNumberedHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_HEADING_LENGTH) return false;
  return NUMBERED_HEADING_REGEX.test(trimmed);
}

/**
 * Извлекает темы только с первой страницы (содержание). Нумерация страниц справа не берётся.
 * Берём только нумерованные пункты вида "1. Болтовня интро", "2. Задача № 1"; числа справа (номера страниц) отбрасываем по позиции X.
 * @param {File} file — файл PDF
 * @returns {Promise<string[]>} массив заголовков в порядке сверху вниз
 */
export async function extractHeadingsFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const items = textContent.items || [];

  // Нумерация страниц обычно справа — отбрасываем текст, у которого X больше ~70% ширины страницы
  const xThreshold = viewport.width * 0.7;

  const byY = new Map();
  for (const item of items) {
    const str = item.str;
    if (str == null) continue;
    const tx = item.transform ? item.transform[4] : 0;
    if (tx > xThreshold) continue;
    const y = item.transform ? item.transform[5] : 0;
    const key = Math.round(y / 3) * 3;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push(str);
  }

  const sortedKeys = [...byY.keys()].sort((a, b) => b - a);
  const allLines = [];
  for (const key of sortedKeys) {
    const parts = byY.get(key);
    const line = (parts || []).join(' ').trim();
    if (line) allLines.push(line);
  }

  return allLines.filter(isNumberedHeading);
}
