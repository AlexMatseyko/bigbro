import React, { useState, useEffect, useRef } from 'react';

import { API_BASE } from '../config';

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
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
