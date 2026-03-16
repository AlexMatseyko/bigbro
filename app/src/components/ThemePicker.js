import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const THEMES = [
  { id: 1, label: 'Планиметрия', color: '#38bdf8' },
  { id: 2, label: 'Стереометрия', color: '#4ade80' },
  { id: 3, label: 'Параметр', color: '#facc15' },
  { id: 4, label: 'Неравенства', color: '#f97316' },
  { id: 5, label: 'Теория чисел', color: '#a78bfa' },
  { id: 6, label: 'Первая часть', color: '#f43f5e' },
  { id: 7, label: 'Уравнения', color: '#06b6d4' },
  { id: 8, label: 'Русский', color: '#ec4899' },
  { id: 9, label: 'Физика', color: '#14b8a6' },
  { id: 10, label: 'Химия', color: '#eab308' },
  { id: 11, label: 'Ол.Мат.', color: '#84cc16' }
];

const PLACEHOLDER = 'Выбрать тему';

/**
 * Выбор темы конспекта — всплывающее окно со списком тем.
 */
function ThemePicker({ value, onChange, onOpenChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const selected = value != null && value !== '' ? THEMES.find((t) => t.id === Number(value)) : null;
  const displayLabel = selected ? selected.label : PLACEHOLDER;

  return (
    <>
      <div className={`theme-picker theme-picker-dropdown ${className}`} ref={ref}>
        <button
          type="button"
          className="theme-picker-trigger"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          style={selected ? { '--theme-color': selected.color } : undefined}
        >
          <span className="theme-picker-trigger-label">{displayLabel}</span>
        </button>
      </div>

      {open && ReactDOM.createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор темы"
          onClick={() => setOpen(false)}
        >
          <div className="modal-content template-tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Выбрать тему</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="task-modal-list-wrap">
                <button
                  type="button"
                  className="task-modal-item task-modal-item-clear"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Не выбрана
                </button>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="task-modal-item"
                    data-selected={selected && selected.id === t.id ? 'true' : 'false'}
                    onClick={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ThemePicker;
export { THEMES };
