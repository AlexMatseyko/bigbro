import React, { useState, useEffect, useCallback } from 'react';
import {
  loadTables,
  saveTables,
  createEmptyTable,
  createTemplateTable
} from '../utils/tableStorage';
import CreateTableModal from './CreateTableModal';
import TemplateTasksModal from './TemplateTasksModal';
import SheetView from './SheetView';

/** Страница «Таблицы»: список таблиц, создание (пустая / шаблонная), редактор в стиле Google Sheets. */
function PageTables() {
  const [tables, setTables] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [openTableId, setOpenTableId] = useState(null);

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
        <h2 className="page-placeholder-title">Таблицы</h2>
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
            <li key={t.id} className="tables-list-item card tracker-card">
              <button
                type="button"
                className="tables-list-card"
                onClick={() => handleOpenTable(t.id)}
              >
                <span className="tables-list-name">{t.name || 'Без названия'}</span>
                <span className="tables-list-meta">
                  {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost tables-list-delete"
                onClick={(e) => handleDeleteTable(e, t.id)}
                aria-label="Удалить таблицу"
              >
                Удалить
              </button>
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
        onConfirm={handleCreateTemplate}
      />
    </section>
  );
}

export default PageTables;
