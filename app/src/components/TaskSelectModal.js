import React, { useState, useMemo } from 'react';

// Нормализованные статусы от сервера → пользовательские названия в приложении.
// id должен совпадать с statusTitle из API (tasks.js), label — то, что видит пользователь.
const STATUS_FILTERS = [
  { id: 'Не выполняется', label: 'Не начато' },
  { id: 'В работе', label: 'В работе' },
  { id: 'Ожидает контроля', label: 'На проверке' }
];

const ALL_STATUS_IDS = STATUS_FILTERS.map((s) => s.id);

function getTaskLabel(t) {
  return t.title || t.name || t.summary || `#${t.id}`;
}

function getDisplayStatusTitle(statusTitle) {
  const found = STATUS_FILTERS.find((s) => s.id === statusTitle);
  return found ? found.label : statusTitle;
}

function TaskSelectModal({ open, onClose, tasks, selectedTask, onSelectTask }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => new Set(ALL_STATUS_IDS));

  const toggleStatus = (status) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const filteredTasks = useMemo(() => {
    const q = (nameQuery || '').trim().toLowerCase();
    return tasks.filter((t) => {
      const label = getTaskLabel(t);
      if (t.isFree) return !q || label.toLowerCase().includes(q);
      const statusTitle = t.statusTitle || '';
      const matchName = !q || label.toLowerCase().includes(q);
      const matchStatus = statusFilter.size === 0 || statusFilter.has(statusTitle);
      return matchName && matchStatus;
    });
  }, [tasks, nameQuery, statusFilter]);

  const handleSelect = (t) => {
    onSelectTask(t || null);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="task-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="task-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h2 id="task-modal-title" className="task-modal-title">
            Выбор задачи
          </h2>
          <button
            type="button"
            className="task-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="task-modal-filters">
          <button
            type="button"
            className="task-modal-filter-btn"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="task-modal-filter-icon">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            Фильтр
          </button>
          {filterOpen && (
            <div className="task-modal-filter-panel">
              <div className="task-modal-filter-field">
                <label className="task-modal-filter-label">Название задачи</label>
                <input
                  type="text"
                  className="input task-modal-filter-input"
                  placeholder="Поиск по названию…"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                />
              </div>
              <div className="task-modal-filter-field">
                <span className="task-modal-filter-label">Статус</span>
                <div className="task-modal-filter-checkboxes">
                  {STATUS_FILTERS.map((status) => (
                    <label key={status.id} className="task-modal-filter-check">
                      <input
                        type="checkbox"
                        checked={statusFilter.has(status.id)}
                        onChange={() => toggleStatus(status.id)}
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="task-modal-list-wrap">
          <button
            type="button"
            className="task-modal-item task-modal-item-clear"
            onClick={() => handleSelect(null)}
          >
            Не выбирать задачу
          </button>
          {filteredTasks.map((t) => {
            const label = getTaskLabel(t);
            const statusText = t.isFree ? '' : getDisplayStatusTitle(t.statusTitle || '');
            const isSelected = selectedTask && getTaskLabel(selectedTask) === label;
            return (
              <button
                key={t.id ?? 'free'}
                type="button"
                className={`task-modal-item${t.isFree ? ' task-modal-item-free' : ''}`}
                data-selected={isSelected}
                onClick={() => handleSelect(t)}
              >
                <span className="task-modal-item-label">{label}</span>
                {statusText ? <span className="task-modal-item-status">{statusText}</span> : null}
              </button>
            );
          })}
          {filteredTasks.length === 0 && (
            <p className="task-modal-empty">Нет задач по выбранным фильтрам</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskSelectModal;
export { getTaskLabel, getDisplayStatusTitle };
