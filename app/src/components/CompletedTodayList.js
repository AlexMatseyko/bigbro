import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://localhost:5000';
const POLL_INTERVAL_MS = 20000;

function CompletedTodayList({ refreshTrigger }) {
  const [dateLabel, setDateLabel] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetchRef = useRef(null);

  const fetchCompletedToday = useCallback(async () => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/completed-today`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Не удалось загрузить список.');
        setTasks([]);
        setDateLabel('');
        return;
      }
      setError('');
      setDateLabel(data.dateLabel || '');
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (err) {
      console.error('CompletedToday fetch error', err);
      setError('Ошибка связи с сервером.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRef.current = fetchCompletedToday;
  }, [fetchCompletedToday]);

  useEffect(() => {
    fetchCompletedToday();
  }, [fetchCompletedToday, refreshTrigger]);

  useEffect(() => {
    const id = setInterval(() => {
      if (fetchRef.current) fetchRef.current();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const openTask = (taskUrl) => {
    if (taskUrl) window.open(taskUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading && tasks.length === 0) {
    return (
      <section className="completed-today-list" aria-label="Выполненные задачи за день">
        <p className="completed-today-loading">Загрузка списка…</p>
      </section>
    );
  }

  return (
    <section className="completed-today-list" aria-label="Выполненные задачи за день">
      <h3 className="completed-today-title">
        Выполненные задачи за {dateLabel || '—'}
        <span className="completed-today-count"> ({tasks.length})</span>
      </h3>
      {error && <p className="completed-today-error">{error}</p>}
      <ul className="completed-today-ul">
        {tasks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="completed-today-item"
              onClick={() => openTask(t.taskUrl)}
            >
              {t.name || `Задача ${t.id}`}
            </button>
          </li>
        ))}
      </ul>
      {!error && tasks.length === 0 && dateLabel && (
        <p className="completed-today-empty">Пока нет задач за сегодня</p>
      )}
    </section>
  );
}

export default CompletedTodayList;
