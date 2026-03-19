import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createEmptyTable,
  createTemplateTable,
  createTemplateTableFromHeadings
} from '../utils/tableStorage';
import { columnLetter } from '../utils/tableStorage';
import { fetchTables, createTable, updateTable, deleteTable } from '../api/tableApi';
import { API_BASE } from '../config';
import CreateTableModal from './CreateTableModal';
import TemplateTasksModal from './TemplateTasksModal';
import SheetView from './SheetView';
import MethodistPicker from './MethodistPicker';
import ThemePicker, { THEMES } from './ThemePicker';
import FilesModal from './FilesModal';

const COL_A = 0;
const COL_EXECUTOR = 9;
const TASK_START_ROW = 2;

/**
 * Подсчёт задач в таблице: всего (с непустым названием в колонке A) и свободных (без исполнителя в колонке J).
 * @param {{ cells?: Record<string, string>, rowCount?: number }} table
 * @returns {{ total: number, free: number }}
 */
function countTableTasks(table) {
  const cells = table.cells || {};
  const rowCount = Math.max(1, Number(table.rowCount) || 35);
  const aLetter = columnLetter(COL_A);
  const executorLetter = columnLetter(COL_EXECUTOR);
  let total = 0;
  let free = 0;
  for (let r = TASK_START_ROW; r <= rowCount; r++) {
    const name = (cells[`${aLetter}${r}`] || '').trim();
    if (!name) continue;
    total += 1;
    const assignee = (cells[`${executorLetter}${r}`] || '').trim();
    if (!assignee) free += 1;
  }
  return { total, free };
}

/**
 * Класс для цвета индикатора свободных задач: >75% — зелёный, >50% — оранжевый, иначе красный.
 */
function freeTasksColorClass(total, free) {
  if (total === 0) return 'tables-list-free--neutral';
  const ratio = free / total;
  if (ratio > 0.75) return 'tables-list-free--green';
  if (ratio > 0.5) return 'tables-list-free--orange';
  return 'tables-list-free--red';
}

/** Страница «Таблицы»: список таблиц с API (все пользователи видят все таблицы). */
function PageTables() {
  const [tables, setTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [openTableId, setOpenTableId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [openDropdownTableId, setOpenDropdownTableId] = useState(null);
  const [newlyCreatedTableId, setNewlyCreatedTableId] = useState(null);
  const [pendingCreateMeta, setPendingCreateMeta] = useState(null);

  const [filterName, setFilterName] = useState('');
  const [filterMethodistId, setFilterMethodistId] = useState('');
  const [filterThemeId, setFilterThemeId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterFreeMin, setFilterFreeMin] = useState('');
  const [filesModalOpen, setFilesModalOpen] = useState(false);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTables();
      setTables(Array.isArray(list) ? list : []);
      const savedId = window.localStorage.getItem('team-tracker-open-table-id');
      if (savedId && list.some((t) => t.id === savedId)) setOpenTableId(savedId);
    } catch (err) {
      console.error('Load tables error:', err);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    window.localStorage.setItem('team-tracker-open-table-id', openTableId || '');
  }, [openTableId]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const nameQuery = (filterName || '').trim().toLowerCase();
      if (nameQuery && !name.includes(nameQuery)) return false;

      if (filterMethodistId) {
        const mid = t.methodist?.id ?? t.methodist;
        if (String(mid) !== String(filterMethodistId)) return false;
      }

      if (filterThemeId) {
        const tid = t.theme != null ? t.theme : null;
        if (String(tid) !== String(filterThemeId)) return false;
      }

      if (filterDateFrom || filterDateTo) {
        const created = t.createdAt ? new Date(t.createdAt).getTime() : 0;
        if (filterDateFrom) {
          const from = new Date(filterDateFrom);
          from.setHours(0, 0, 0, 0);
          if (created < from.getTime()) return false;
        }
        if (filterDateTo) {
          const to = new Date(filterDateTo);
          to.setHours(23, 59, 59, 999);
          if (created > to.getTime()) return false;
        }
      }

      const freeNum = Number(filterFreeMin);
      if (!Number.isNaN(freeNum) && freeNum > 0) {
        const { free } = countTableTasks(t);
        if (free < freeNum) return false;
      }

      return true;
    });
  }, [tables, filterName, filterMethodistId, filterThemeId, filterDateFrom, filterDateTo, filterFreeMin]);

  const applyMeta = (table, meta) => ({
    ...table,
    name: (meta && meta.name) ? meta.name : (table.name || 'Новая таблица'),
    methodist: meta && meta.methodist !== undefined ? meta.methodist : table.methodist,
    theme: meta && meta.theme !== undefined ? meta.theme : table.theme
  });

  const handleCreateEmpty = async (meta) => {
    setCreateModalOpen(false);
    const t = applyMeta(createEmptyTable(), meta || {});
    try {
      const created = await createTable(t);
      setTables((prev) => [created, ...prev]);
      setOpenTableId(created.id);
      setNewlyCreatedTableId(created.id);
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Не удалось создать таблицу.');
    }
  };

  const handleCreateTemplate = async (taskCount) => {
    setTemplateModalOpen(false);
    const meta = pendingCreateMeta || {};
    setPendingCreateMeta(null);
    const t = applyMeta(createTemplateTable(taskCount), meta);
    try {
      const created = await createTable(t);
      setTables((prev) => [created, ...prev]);
      setOpenTableId(created.id);
      setNewlyCreatedTableId(created.id);
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Не удалось создать таблицу.');
    }
  };

  const handleCreateTemplateFromHeadings = async (headings) => {
    setTemplateModalOpen(false);
    const meta = pendingCreateMeta || {};
    setPendingCreateMeta(null);
    const t = applyMeta(createTemplateTableFromHeadings(headings), meta);
    try {
      const created = await createTable(t);
      setTables((prev) => [created, ...prev]);
      setOpenTableId(created.id);
      setNewlyCreatedTableId(created.id);
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Не удалось создать таблицу.');
    }
  };

  const handleOpenTemplateModal = (meta) => {
    setCreateModalOpen(false);
    setPendingCreateMeta(meta || {});
    setTemplateModalOpen(true);
  };

  const handleOpenTable = (id) => setOpenTableId(id);

  const handleBackFromSheet = () => {
    setOpenTableId(null);
    setNewlyCreatedTableId(null);
  };

  const handleSaveSheet = async (updatedTable) => {
    try {
      const saved = await updateTable(updatedTable.id, updatedTable);
      setTables((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Не удалось сохранить таблицу.');
    }
  };

  const handleDeleteTable = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Вы уверены, что хотите удалить таблицу?')) return;
    try {
      await deleteTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
      if (openTableId === id) setOpenTableId(null);
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Не удалось удалить таблицу.');
    }
  };

  const handleUpdateTableMeta = async (id, patch) => {
    const t = tables.find((x) => x.id === id);
    if (!t) return;
    const payload = { ...t, ...patch };
    try {
      const saved = await updateTable(id, payload);
      setTables((prev) => prev.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const startEditName = (e, t) => {
    e.stopPropagation();
    setEditingNameId(t.id);
    setEditingNameValue(t.name || 'Без названия');
  };

  const commitEditName = (id) => {
    const value = editingNameValue.trim();
    if (value) handleUpdateTableMeta(id, { name: value });
    setEditingNameId(null);
  };

  const openTable = tables.find((t) => t.id === openTableId);

  if (openTable) {
    return (
      <SheetView
        table={openTable}
        onSave={handleSaveSheet}
        onBack={handleBackFromSheet}
        initialFocusTitle={openTable.id === newlyCreatedTableId}
      />
    );
  }

  const hasActiveFilters = !!(filterName.trim() || filterMethodistId || filterThemeId || filterDateFrom || filterDateTo || (filterFreeMin !== '' && Number(filterFreeMin) > 0));
  const clearFilters = () => {
    setFilterName('');
    setFilterMethodistId('');
    setFilterThemeId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterFreeMin('');
  };

  return (
    <section className="tables-page">
      <div className="tables-page-header">
        <h2 className="page-placeholder-title tables-page-title">Таблицы</h2>
        <button
          type="button"
          className="btn btn-primary tables-create-btn"
          onClick={() => setCreateModalOpen(true)}
        >
          Создать таблицу
        </button>
      </div>

      {!loading && tables.length > 0 && (
        <div className="tables-filters card tracker-card">
          <div className="tables-filters-row">
            <label className="tables-filters-label">
              Название
              <input
                type="text"
                className="tables-filters-input"
                placeholder="Поиск по названию"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </label>
            <label className="tables-filters-label">
              Методист
              <select
                className="tables-filters-select"
                value={filterMethodistId}
                onChange={(e) => setFilterMethodistId(e.target.value)}
              >
                <option value="">Любой</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени'}
                  </option>
                ))}
              </select>
            </label>
            <label className="tables-filters-label">
              Тема
              <select
                className="tables-filters-select"
                value={filterThemeId}
                onChange={(e) => setFilterThemeId(e.target.value)}
              >
                <option value="">Любая</option>
                {THEMES.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tables-filters-label">
              Дата от
              <input
                type="date"
                className="tables-filters-input tables-filters-date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </label>
            <label className="tables-filters-label">
              Дата до
              <input
                type="date"
                className="tables-filters-input tables-filters-date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </label>
            <label className="tables-filters-label">
              Свободных задач не менее
              <input
                type="number"
                className="tables-filters-input tables-filters-number"
                min={0}
                placeholder="0"
                value={filterFreeMin}
                onChange={(e) => setFilterFreeMin(e.target.value)}
              />
            </label>
            {hasActiveFilters && (
              <button type="button" className="btn btn-ghost tables-filters-clear" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Загрузка таблиц…</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Список таблиц пуст. Нажмите «Создать таблицу», чтобы добавить пустую или шаблонную таблицу.</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Нет таблиц по выбранным фильтрам. Измените условия или сбросьте фильтры.</p>
        </div>
      ) : (
        <ul className="tables-list">
          {filteredTables.map((t) => (
            <li
              key={t.id}
              className={`tables-list-item card tracker-card ${openDropdownTableId === t.id ? 'tables-list-item--dropdown-open' : ''}`}
              data-theme={t.theme != null ? t.theme : 1}
              style={{ '--table-theme-color': THEMES.find((x) => x.id === (t.theme ?? 1))?.color || THEMES[0].color }}
            >
              <div className="tables-list-main">
                <div className="tables-list-main-left">
                  <button
                    type="button"
                    className="tables-list-open"
                    onClick={() => handleOpenTable(t.id)}
                  >
                    Открыть
                  </button>
                  <div className="tables-list-name-block">
                    <div className="tables-list-name-row">
                      {editingNameId === t.id ? (
                        <input
                          type="text"
                          className="tables-list-name-input"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => commitEditName(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditName(t.id);
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="tables-list-name-btn"
                          onClick={(e) => startEditName(e, t)}
                        >
                          {t.name || 'Без названия'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary tables-list-files"
                        onClick={() => setFilesModalOpen(true)}
                      >
                        Файлы
                      </button>
                    </div>
                    <span className="tables-list-meta">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : ''}
                    </span>
                  </div>
                </div>
                <div className="tables-list-main-right">
                  <div className="tables-list-free-block">
                    {(() => {
                      const { total, free } = countTableTasks(t);
                      return (
                        <span className={`tables-list-free ${freeTasksColorClass(total, free)}`}>
                          Задач свободно: {free}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="tables-list-methodist">
                    <MethodistPicker
                      value={t.methodist || null}
                      onChange={(methodist) => handleUpdateTableMeta(t.id, { methodist })}
                      onOpenChange={(open) => setOpenDropdownTableId(open ? t.id : null)}
                      placeholder="Методист"
                    />
                  </div>
                  <div className="tables-list-theme">
                    <ThemePicker
                      value={t.theme != null ? t.theme : null}
                      onChange={(theme) => handleUpdateTableMeta(t.id, { theme })}
                      onOpenChange={(open) => setOpenDropdownTableId(open ? t.id : null)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost tables-list-delete"
                    onClick={(e) => handleDeleteTable(e, t.id)}
                    aria-label="Удалить таблицу"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateTableModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onEmpty={handleCreateEmpty}
        onTemplate={handleOpenTemplateModal}
      />

      <TemplateTasksModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onConfirmCount={handleCreateTemplate}
        onConfirmHeadings={handleCreateTemplateFromHeadings}
      />

      <FilesModal
        open={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
      />
    </section>
  );
}

export default PageTables;
