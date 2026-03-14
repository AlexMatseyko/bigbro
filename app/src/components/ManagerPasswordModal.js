import React, { useState, useRef, useEffect } from 'react';

function ManagerPasswordModal({ open, onClose, onSuccess, expectedPassword }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (password.trim() === (expectedPassword || '')) {
      onSuccess();
      onClose();
    } else {
      setError('Неверный пароль');
    }
  };

  if (!open) return null;

  return (
    <div
      className="task-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manager-password-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="task-modal-panel manager-password-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h2 id="manager-password-title" className="task-modal-title">
            Для руководителей
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
        <form className="manager-password-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="manager-password-input" className="label">
              Введите пароль
            </label>
            <input
              ref={inputRef}
              id="manager-password-input"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="manager-password-error">{error}</p>}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary">
              Войти
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ManagerPasswordModal;
