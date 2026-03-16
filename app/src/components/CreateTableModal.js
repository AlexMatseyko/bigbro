import React, { useState, useEffect } from 'react';
import MethodistPicker from './MethodistPicker';
import ThemePicker from './ThemePicker';

/**
 * Окно создания таблицы: название, методист, тема + выбор «пустая» или «шаблонная».
 * При выборе типа вызывается onEmpty(meta) или onTemplate(meta), где meta = { name, methodist, theme }.
 */
function CreateTableModal({ open, onClose, onEmpty, onTemplate }) {
  const [name, setName] = useState('');
  const [methodist, setMethodist] = useState(null);
  const [theme, setTheme] = useState(null);
  const [showValidationError, setShowValidationError] = useState(false);
  const trimmedName = (name || '').trim();
  const isValid = !!trimmedName && theme != null;

  useEffect(() => {
    if (open) {
      setName('');
      setMethodist(null);
      setTheme(null);
      setShowValidationError(false);
    }
  }, [open]);

  if (!open) return null;

  const meta = { name: trimmedName, methodist, theme };

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
                placeholder="Введите название таблицы"
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
            {showValidationError && !isValid && (
              <div className="create-table-validation">
                <span className="create-table-error">Не выбрано название и тема.</span>
              </div>
            )}
          </div>
          <div className="create-table-options">
            <button
              type="button"
              className="create-table-option"
              onClick={() => {
                if (!isValid) {
                  setShowValidationError(true);
                  return;
                }
                setShowValidationError(false);
                onEmpty(meta);
              }}
            >
              Создать пустую таблицу
            </button>
            <button
              type="button"
              className="create-table-option"
              onClick={() => {
                if (!isValid) {
                  setShowValidationError(true);
                  return;
                }
                setShowValidationError(false);
                onTemplate(meta);
              }}
            >
              Создать шаблонную таблицу
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateTableModal;
