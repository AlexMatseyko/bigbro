import React, { useState } from 'react';

const API_BASE = 'http://localhost:5000';

function TaskActionsPanel({ taskId, onSendSuccess }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSendTask = async () => {
    if (!taskId) return;
    setSending(true);
    setError('');
    try {
      const token = window.localStorage.getItem('token');
      if (!token) {
        setError('Нужна авторизация.');
        return;
      }
      const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Не удалось отправить задачу.');
        return;
      }
      const taskUrl = data.taskUrl;
      if (taskUrl) {
        window.open(taskUrl, '_blank', 'noopener,noreferrer');
      }
      onSendSuccess?.();
    } catch (err) {
      console.error('Send task error', err);
      setError('Ошибка связи с сервером.');
    } finally {
      setSending(false);
    }
  };

  const canSend = !!taskId && !sending;

  return (
    <section className="task-actions-panel" aria-label="Действия с задачей">
      <div className="task-actions-panel-inner">
        <button
          type="button"
          className="btn btn-send-task"
          disabled={!canSend}
          onClick={handleSendTask}
          aria-busy={sending}
        >
          Отправить задачу
        </button>
        <p className="task-actions-panel-hint">Отправить задачу и загрузить материалы</p>
      </div>
      {error && <p className="task-actions-panel-error">{error}</p>}
    </section>
  );
}

export default TaskActionsPanel;
