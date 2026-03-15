import React, { useState } from 'react';

/**
 * Выбор количества задач (1–99) для шаблонной таблицы. После подтверждения — создание таблицы с A1=Задача 1, ..., AN=Задача N.
 */
function TemplateTasksModal({ open, onClose, onConfirm }) {
  const [count, setCount] = useState(5);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.min(99, parseInt(count, 10) || 1));
    onConfirm(n);
    setCount(5);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Количество задач">
      <div className="modal-content template-tasks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Создать шаблонную таблицу</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">&times;</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="template-tasks-label">
            Количество задач (1–99):
            <input
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="template-tasks-input"
            />
          </label>
          <p className="template-tasks-hint">
            В колонке A будут созданы ячейки: Задача 1, Задача 2, … Задача {Math.max(1, Math.min(99, parseInt(count, 10) || 1))}.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary">Создать</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TemplateTasksModal;
