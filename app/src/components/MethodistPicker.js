import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';

/**
 * Выбор методиста (постановщика): выпадающий список пользователей с аватаркой и именем.
 */
function MethodistPicker({ value, onChange, placeholder = 'Выберите методиста', className = '' }) {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const selected = value && users.find((u) => u.id === value.id);
  const displayName = selected
    ? `${selected.last_name || ''} ${selected.first_name || ''}`.trim() || 'Без имени'
    : placeholder;

  return (
    <div className={`methodist-picker ${className}`} ref={ref}>
      <button
        type="button"
        className="methodist-picker-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.avatar ? (
          <img
            src={selected.avatar.startsWith('http') ? selected.avatar : `${API_BASE}${selected.avatar}`}
            alt=""
            className="methodist-picker-avatar"
          />
        ) : (
          <span className="methodist-picker-avatar methodist-picker-avatar-placeholder">
            {displayName.slice(0, 2).toUpperCase() || '?'}
          </span>
        )}
        <span className="methodist-picker-label">{displayName}</span>
      </button>
      {open && (
        <ul className="methodist-picker-dropdown" role="listbox">
          <li role="option">
            <button
              type="button"
              className="methodist-picker-option"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className="methodist-picker-avatar-placeholder">—</span>
              <span>Не выбран</span>
            </button>
          </li>
          {users.map((u) => (
            <li key={u.id} role="option">
              <button
                type="button"
                className="methodist-picker-option"
                onClick={() => {
                  onChange({ id: u.id, first_name: u.first_name, last_name: u.last_name, avatar: u.avatar });
                  setOpen(false);
                }}
              >
                {u.avatar ? (
                  <img
                    src={u.avatar.startsWith('http') ? u.avatar : `${API_BASE}${u.avatar}`}
                    alt=""
                    className="methodist-picker-avatar"
                  />
                ) : (
                  <span className="methodist-picker-avatar-placeholder">
                    {(u.last_name || u.first_name || '').slice(0, 2).toUpperCase() || '?'}
                  </span>
                )}
                <span>{`${u.last_name || ''} ${u.first_name || ''}`.trim() || 'Без имени'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MethodistPicker;
