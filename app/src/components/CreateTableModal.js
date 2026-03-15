import React, { useState, useEffect } from 'react';
import MethodistPicker from './MethodistPicker';
import ThemePicker from './ThemePicker';

/**
 * Окно создания таблицы: название, методист, тема + выбор «пустая» или «шаблонная».
 * При выборе типа вызывается onEmpty(meta) или onTemplate(meta), где meta = { name, methodist, theme }.
 */
function CreateTableModal({ open, onClose, onEmpty, onTemplate }) {
  const [name, setName] = useState('Новая таблица');
  const [methodist, setMethodist] = useState(null);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    if (open) {
      setName('Новая таблица');
      setMethodist(null);
      setTheme(null);
    }
  }, [open]);

  if (!open) return null;

  const meta = { name: (name || '').trim() || 'Новая таблица', methodist, theme };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Создать таблицу">
      <div className="modal-content create-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Создать таблицу</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">&times;</button>
        </div>
        <div className="modal-body">
          <div className="create-table-meta">
            <label className="template-tasks-label">
              Название
              <input
                type="text"
                className="template-tasks-input create-table-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Новая таблица"
              />
            </label>
            <div className="create-table-pickers">
              <label className="template-tasks-label create-table-picker-label">
                Методист
                <div className="create-table-picker-wrap">
                  <MethodistPicker
                    value={methodist}
                    onChange={setMethodist}
                    placeholder="Не выбран"
                  />
                </div>
              </label>
              <label className="template-tasks-label create-table-picker-label">
                Тема
                <div className="create-table-picker-wrap">
                  <ThemePicker value={theme} onChange={setTheme} />
                </div>
              </label>
            </div>
          </div>
          <div className="create-table-options">
            <button type="button" className="create-table-option" onClick={() => onEmpty(meta)}>
              Создать пустую таблицу
            </button>
            <button type="button" className="create-table-option" onClick={() => onTemplate(meta)}>
              Создать шаблонную таблицу
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateTableModal;
