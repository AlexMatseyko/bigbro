import React, { useState, useEffect, useCallback } from 'react';
import {
  loadTables,
  saveTables,
  createEmptyTable,
  createTemplateTable,
  createTemplateTableFromHeadings
} from '../utils/tableStorage';
import CreateTableModal from './CreateTableModal';
import TemplateTasksModal from './TemplateTasksModal';
import SheetView from './SheetView';
import MethodistPicker from './MethodistPicker';
import ThemePicker, { THEMES } from './ThemePicker';

/** Страница «Таблицы»: список таблиц, создание (пустая / шаблонная: число или PDF), редактор. */
function PageTables() {
  const [tables, setTables] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [openTableId, setOpenTableId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  useEffect(() => {
    setTables(loadTables());
  }, []);

  const persist = useCallback((nextTables) => {
    setTables(nextTables);
    saveTables(nextTables);
  }, []);

  const handleCreateEmpty = () => {
    setCreateModalOpen(false);
    const t = createEmptyTable();
    persist([...tables, t]);
    setOpenTableId(t.id);
  };

  const handleCreateTemplate = (taskCount) => {
    setTemplateModalOpen(false);
    const t = createTemplateTable(taskCount);
    persist([...tables, t]);
    setOpenTableId(t.id);
  };

  const handleCreateTemplateFromHeadings = (headings) => {
    setTemplateModalOpen(false);
    const t = createTemplateTableFromHeadings(headings);
    persist([...tables, t]);
    setOpenTableId(t.id);
  };

  const handleOpenTable = (id) => setOpenTableId(id);

  const handleBackFromSheet = () => setOpenTableId(null);

  const handleSaveSheet = (updatedTable) => {
    const next = tables.map((t) => (t.id === updatedTable.id ? updatedTable : t));
    persist(next);
  };

  const handleDeleteTable = (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Удалить эту таблицу?')) return;
    const next = tables.filter((t) => t.id !== id);
    persist(next);
    if (openTableId === id) setOpenTableId(null);
  };

  const handleUpdateTableMeta = (id, patch) => {
    const next = tables.map((t) => (t.id === id ? { ...t, ...patch } : t));
    persist(next);
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

      {tables.length === 0 ? (
        <div className="tables-empty card tracker-card">
          <p className="page-placeholder-text">Список таблиц пуст. Нажмите «Создать таблицу», чтобы добавить пустую или шаблонную таблицу.</p>
        </div>
      ) : (
        <ul className="tables-list">
          {tables.map((t) => (
            <li
              key={t.id}
              className="tables-list-item card tracker-card"
              data-theme={t.theme != null ? t.theme : 1}
              style={{ '--table-theme-color': THEMES.find((x) => x.id === (t.theme ?? 1))?.color || THEMES[0].color }}
            >
              <div className="tables-list-main">
                <div className="tables-list-name-block">
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
                  <span className="tables-list-meta">
                    {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <div className="tables-list-methodist">
                  <MethodistPicker
                    value={t.methodist || null}
                    onChange={(methodist) => handleUpdateTableMeta(t.id, { methodist })}
                    placeholder="Методист"
                  />
                </div>
                <div className="tables-list-theme">
                  <ThemePicker
                    value={t.theme != null ? t.theme : 1}
                    onChange={(theme) => handleUpdateTableMeta(t.id, { theme })}
                  />
                </div>
                <button
                  type="button"
                  className="tables-list-open"
                  onClick={() => handleOpenTable(t.id)}
                >
                  Открыть
                </button>
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
        onTemplate={() => {
          setCreateModalOpen(false);
          setTemplateModalOpen(true);
        }}
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
