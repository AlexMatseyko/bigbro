import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * Выбор методиста (постановщика): всплывающее окно со списком пользователей.
 */
function MethodistPicker({ value, onChange, onOpenChange, placeholder = 'Выберите методиста', className = '' }) {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const selected = value && users.find((u) => u.id === value.id);
  const displayName = selected
    ? `${selected.last_name || ''} ${selected.first_name || ''}`.trim() || 'Без имени'
    : placeholder;

  return (
    <>
      <div className={`methodist-picker ${className}`}>
        <button
          type="button"
          className="methodist-picker-trigger"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
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
      </div>

      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор методиста"
          onClick={() => setOpen(false)}
        >
          <div className="modal-content template-tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Выбрать методиста</h3>
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
                  Не выбран
                </button>
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="task-modal-item"
                    data-selected={selected && selected.id === u.id ? 'true' : 'false'}
                    onClick={() => {
                      onChange({
                        id: u.id,
                        first_name: u.first_name,
                        last_name: u.last_name,
                        avatar: u.avatar
                      });
                      setOpen(false);
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
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
                    </span>
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
        </div>
      )}
    </>
  );
}

export default MethodistPicker;
