import React, { useState, useEffect, useRef } from 'react';

import { API_BASE } from '../config';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatDurationHoursMinutes(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  return `${m} мин`;
}

const STATUS_LABELS = {
  online: 'В сети',
  away: 'Отошёл',
  offline: 'Не в сети',
  paused: 'Пауза'
};

function ProfileModal({ open, onClose, status, token, onAvatarChange }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingAspro, setSyncingAspro] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = typeof token === 'string' ? token : (window.localStorage && window.localStorage.getItem('token'));
    if (!t) {
      setError('Нет токена авторизации');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().catch(() => ({})).then((body) => {
            throw new Error(body.message || `Ошибка ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => setError(err.message || 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, [open, token]);

  const handleAvatarClick = () => {
    fileInputRef.current && fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('avatar', file);
    fetch(`${API_BASE}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
      .then((res) => {
        if (!res.ok) return res.json().then((body) => { throw new Error(body.message || 'Ошибка загрузки'); });
        return res.json();
      })
      .then((data) => {
        const url = data.avatar;
        setProfile((prev) => (prev ? { ...prev, avatar: url } : null));
        if (onAvatarChange) onAvatarChange(url);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const handleSyncAspro = () => {
    const t = typeof token === 'string' ? token : (window.localStorage && window.localStorage.getItem('token'));
    if (!t) return;
    setSyncingAspro(true);
    setSyncMessage(null);
    setError(null);
    fetch(`${API_BASE}/auth/sync-aspro`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setSyncMessage(data.message || (data.aspro_id != null ? 'Привязано.' : 'Не найден в Aspro.'));
        if (data.aspro_id != null && profile) {
          setProfile((prev) => (prev ? { ...prev, aspro_id: data.aspro_id } : null));
        }
      })
      .catch((err) => setSyncMessage(err.message || 'Ошибка запроса'))
      .finally(() => setSyncingAspro(false));
  };

  /** Открыть ответ GET /tasks/raw в новом окне (для отладки: почему не показываются задачи). */
  const handleDebugTasksRaw = () => {
    const t = typeof token === 'string' ? token : (window.localStorage && window.localStorage.getItem('token'));
    if (!t) return;
    fetch(`${API_BASE}/tasks/raw`, { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => res.json())
      .then((data) => {
        const w = window.open('', '_blank');
        if (w) {
          const text = JSON.stringify(data, null, 2);
          w.document.write(
            '<pre style="font-family:monospace; white-space:pre-wrap; padding:16px; font-size:13px;">' +
            escapeHtml(text) +
            '</pre>'
          );
          w.document.title = 'Отладка: /tasks/raw';
        } else {
          alert('Блокировщик открыл окно? Разрешите всплывающие окна и нажмите снова. Или смотрите ответ в консоли (F12).');
          console.log('GET /tasks/raw response:', data);
        }
      })
      .catch((err) => alert('Ошибка: ' + (err.message || 'нет ответа')));
  };

  if (!open) return null;

  return (
    <div
      className="task-modal-backdrop profile-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="task-modal-panel profile-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h2 id="profile-modal-title" className="task-modal-title">
            Профиль
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

        <div className="profile-modal-body">
          {loading && (
            <p className="profile-modal-loading">Загрузка…</p>
          )}
          {error && (
            <p className="profile-modal-error">{error}</p>
          )}
          {!loading && profile && (
            <>
              <div className="profile-avatar-wrap">
                <button
                  type="button"
                  className="profile-avatar-btn"
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  title="Заменить аватарку"
                >
                  <span className="profile-avatar-circle">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar.startsWith('http') ? profile.avatar : `${API_BASE}${profile.avatar}`}
                        alt=""
                        className="profile-avatar-img"
                      />
                    ) : (
                      <span className="profile-avatar-placeholder">
                        {profile.first_name && profile.last_name
                          ? (profile.first_name[0] + profile.last_name[0]).toUpperCase()
                          : '?'}
                      </span>
                    )}
                  </span>
                  {uploading && <span className="profile-avatar-overlay">Загрузка…</span>}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="profile-avatar-input"
                  aria-hidden="true"
                />
              </div>

              <dl className="profile-fields">
                <div className="profile-field">
                  <dt>Фамилия</dt>
                  <dd>{profile.last_name || '—'}</dd>
                </div>
                <div className="profile-field">
                  <dt>Имя</dt>
                  <dd>{profile.first_name || '—'}</dd>
                </div>
                <div className="profile-field">
                  <dt>Почта</dt>
                  <dd>{profile.email || '—'}</dd>
                </div>
                <div className="profile-field">
                  <dt>Статус</dt>
                  <dd>{STATUS_LABELS[status] || status}</dd>
                </div>
                <div className="profile-field">
                  <dt>Сегодня работает</dt>
                  <dd>{formatDurationHoursMinutes(profile.today_online_seconds || 0)}</dd>
                </div>
                <div className="profile-field">
                  <dt>Aspro Cloud</dt>
                  <dd>
                    {profile.aspro_id != null ? (
                      <>ID: {profile.aspro_id}</>
                    ) : (
                      <>
                        Не привязан — задачи не подтянутся.
                        <button
                          type="button"
                          className="profile-sync-aspro-btn"
                          onClick={handleSyncAspro}
                          disabled={syncingAspro}
                        >
                          {syncingAspro ? 'Проверка…' : 'Привязать к Aspro'}
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              {syncMessage && (
                <p className="profile-sync-message">{syncMessage}</p>
              )}
              <div className="profile-debug-wrap">
                <button
                  type="button"
                  className="profile-sync-aspro-btn"
                  onClick={handleDebugTasksRaw}
                >
                  Отладка: ответ /tasks/raw
                </button>
                <span className="profile-debug-hint">Если задачи не показываются — нажмите, откроется ответ сервера в новом окне.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
