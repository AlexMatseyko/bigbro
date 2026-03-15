import React, { useState, useEffect, useRef } from 'react';

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
 * Выбор темы конспекта — выпадающий список с плейсхолдером «Выбрать тему».
 */
function ThemePicker({ value, onChange, onOpenChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const selected = value != null && value !== '' ? THEMES.find((t) => t.id === Number(value)) : null;
  const displayLabel = selected ? selected.label : PLACEHOLDER;

  return (
    <div className={`theme-picker theme-picker-dropdown ${className}`} ref={ref}>
      <button
        type="button"
        className="theme-picker-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={selected ? { '--theme-color': selected.color } : undefined}
      >
        <span className="theme-picker-trigger-label">{displayLabel}</span>
      </button>
      {open && (
        <ul className="theme-picker-dropdown-list" role="listbox">
          {THEMES.map((t) => (
            <li key={t.id} role="option">
              <button
                type="button"
                className={`theme-picker-option ${value === t.id ? 'active' : ''}`}
                style={{ '--theme-color': t.color }}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ThemePicker;
export { THEMES };
