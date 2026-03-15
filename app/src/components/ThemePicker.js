import React from 'react';

const THEMES = [
  { id: 1, label: 'Тема 1', color: '#38bdf8' },
  { id: 2, label: 'Тема 2', color: '#4ade80' },
  { id: 3, label: 'Тема 3', color: '#facc15' },
  { id: 4, label: 'Тема 4', color: '#f97316' },
  { id: 5, label: 'Тема 5', color: '#a78bfa' }
];

/**
 * Выбор темы конспекта (Тема 1 … Тема 5) разными цветами.
 */
function ThemePicker({ value, onChange, className = '' }) {
  return (
    <div className={`theme-picker ${className}`}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`theme-picker-chip ${value === t.id ? 'active' : ''}`}
          style={{ '--theme-color': t.color }}
          onClick={() => onChange(t.id)}
          title={t.label}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default ThemePicker;
export { THEMES };
