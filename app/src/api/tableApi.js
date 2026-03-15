import { API_BASE } from '../config';

function getAuthHeaders() {
  const token = window.localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Список всех таблиц (общих для всех пользователей).
 * @returns {Promise<Array>}
 */
export async function fetchTables() {
  const res = await fetch(`${API_BASE}/tables`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(res.statusText || 'Ошибка загрузки таблиц');
  return res.json();
}

/**
 * Создать таблицу.
 * @param {Object} table — { id, name, cells?, rowCount?, methodist?, theme?, colWidths? }
 * @returns {Promise<Object>}
 */
export async function createTable(table) {
  const res = await fetch(`${API_BASE}/tables`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      id: table.id,
      name: table.name || 'Новая таблица',
      cells: table.cells || {},
      rowCount: table.rowCount != null ? table.rowCount : 35,
      methodist: table.methodist || null,
      theme: table.theme != null ? table.theme : null,
      colWidths: table.colWidths && typeof table.colWidths === 'object' ? table.colWidths : {}
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка создания таблицы');
  }
  return res.json();
}

/**
 * Обновить таблицу.
 * @param {string} id
 * @param {Object} table — поля для обновления
 */
export async function updateTable(id, table) {
  const res = await fetch(`${API_BASE}/tables/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: table.name,
      cells: table.cells,
      rowCount: table.rowCount,
      methodist: table.methodist,
      theme: table.theme,
      colWidths: table.colWidths
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка обновления таблицы');
  }
  return res.json();
}

/**
 * Удалить таблицу.
 * @param {string} id
 */
export async function deleteTable(id) {
  const res = await fetch(`${API_BASE}/tables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка удаления таблицы');
  }
}
