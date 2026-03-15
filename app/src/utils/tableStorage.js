/** Ключ в localStorage для списка таблиц */
const STORAGE_KEY = 'team-tracker-tables';

/** Количество строк по умолчанию */
const DEFAULT_ROW_COUNT = 35;
/** Шаг добавления строк */
const ROWS_ADD_STEP = 20;

/**
 * @typedef {Object} TableRecord
 * @property {string} id
 * @property {string} name
 * @property {Record<string, string>} cells
 * @property {number} createdAt
 * @property {number} [rowCount] — количество строк (по умолчанию 35)
 * @property {{ id: number, first_name: string, last_name: string, avatar?: string|null }} [methodist] — методист (постановщик)
 * @property {number} [theme] — тема конспекта 1–5
 */

/**
 * Генерирует уникальный id таблицы.
 * @returns {string}
 */
export function generateTableId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Возвращает букву колонки по индексу (0 → A, 1 → B, ..., 26 → AA).
 * @param {number} index
 * @returns {string}
 */
export function columnLetter(index) {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Индекс колонки по букве (A → 0, B → 1, AA → 26).
 * @param {string} letters
 * @returns {number}
 */
export function columnIndex(letters) {
  const str = (letters || '').toUpperCase().replace(/[^A-Z]/g, '');
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    n = n * 26 + (str.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Загружает список таблиц из localStorage.
 * @returns {TableRecord[]}
 */
export function loadTables() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Сохраняет список таблиц в localStorage.
 * @param {TableRecord[]} tables
 */
export function saveTables(tables) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch (e) {
    console.warn('tableStorage saveTables failed', e);
  }
}

export { DEFAULT_ROW_COUNT, ROWS_ADD_STEP };

/**
 * Создаёт пустую таблицу (35 строк по умолчанию).
 * @param {string} [name]
 * @returns {TableRecord}
 */
export function createEmptyTable(name = 'Новая таблица') {
  return {
    id: generateTableId(),
    name,
    cells: {},
    createdAt: Date.now(),
    rowCount: DEFAULT_ROW_COUNT,
    colWidths: {}
  };
}

/**
 * Создаёт шаблонную таблицу с N задачами в колонке A. Строк: max(35, N).
 * @param {number} taskCount — от 1 до 99
 * @param {string} [name]
 * @returns {TableRecord}
 */
export function createTemplateTable(taskCount, name = 'Таблица по шаблону') {
  const n = Math.max(1, Math.min(99, Math.floor(Number(taskCount)) || 1));
  const cells = {};
  for (let r = 1; r <= n; r++) {
    cells[`A${r}`] = `Задача ${r}`;
  }
  const rowCount = n > DEFAULT_ROW_COUNT ? n : DEFAULT_ROW_COUNT;
  return {
    id: generateTableId(),
    name,
    cells,
    createdAt: Date.now(),
    rowCount,
    colWidths: {}
  };
}

/**
 * Создаёт шаблонную таблицу из списка заголовков (A1 = headings[0], A2 = headings[1], …).
 * Строк: max(35, headings.length).
 * @param {string[]} headings
 * @param {string} [name]
 * @returns {TableRecord}
 */
export function createTemplateTableFromHeadings(headings, name = 'Таблица из PDF') {
  const list = Array.isArray(headings) ? headings.filter((h) => String(h).trim()) : [];
  const cells = {};
  list.forEach((h, i) => {
    cells[`A${i + 1}`] = String(h).trim();
  });
  const rowCount = list.length > DEFAULT_ROW_COUNT ? list.length : DEFAULT_ROW_COUNT;
  return {
    id: generateTableId(),
    name,
    cells,
    createdAt: Date.now(),
    rowCount,
    colWidths: {}
  };
}
