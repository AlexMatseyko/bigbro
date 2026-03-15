import React, { useState, useEffect, useCallback } from 'react';
import {
  createEmptyTable,
  createTemplateTable,
  createTemplateTableFromHeadings
} from '../utils/tableStorage';
import { fetchTables, createTable, updateTable, deleteTable } from '../api/tableApi';
import CreateTableModal from './CreateTableModal';
import TemplateTasksModal from './TemplateTasksModal';
import SheetView from './SheetView';
import MethodistPicker from './MethodistPicker';
import ThemePicker, { THEMES } from './ThemePicker';

/** Страница «Таблицы»: список таблиц с API (все пользователи видят все таблицы). */
function PageTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [openTableId, setOpenTableId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [openDropdownTableId, setOpenDropdownTableId] = useState(null);
  const [newlyCreatedTableId, setNewlyCreatedTableId] = useState(null);
  const [pendingCreateMeta, setPendingCreateMeta] = useState(null);

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
    window.localStorage.setItem('team-tracker-open-table-id', openTableId || '');
  }, [openTableId]);

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

      {loading ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Загрузка таблиц…</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Список таблиц пуст. Нажмите «Создать таблицу», чтобы добавить пустую или шаблонную таблицу.</p>
        </div>
      ) : (
        <ul className="tables-list">
          {tables.map((t) => (
            <li
              key={t.id}
              className={`tables-list-item card tracker-card ${openDropdownTableId === t.id ? 'tables-list-item--dropdown-open' : ''}`}
              data-theme={t.theme != null ? t.theme : 1}
              style={{ '--table-theme-color': THEMES.find((x) => x.id === (t.theme ?? 1))?.color || THEMES[0].color }}
            >
              <div className="tables-list-main">
                <div className="tables-list-name-block">
                  <div className="tables-list-name-row">
                    <button
                      type="button"
                      className="tables-list-open"
                      onClick={() => handleOpenTable(t.id)}
                    >
                      Открыть
                    </button>
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
                  </div>
                  <span className="tables-list-meta">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : ''}
                  </span>
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
    </section>
  );
}

export default PageTables;
