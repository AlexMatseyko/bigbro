import React from 'react';

import { API_BASE } from '../config';

function TrackerPanel({ task, taskId, status, onStatusChange }) {
  const normalizedStatus = status || 'offline';

  const getStatusText = () => {
    if (normalizedStatus === 'online') return 'В СЕТИ';
    if (normalizedStatus === 'away') return 'Отошел';
    if (normalizedStatus === 'paused') return 'Пауза';
    return 'Не в сети';
  };

  const getStatusClass = () => {
    if (normalizedStatus === 'online') return 'status-online';
    if (normalizedStatus === 'away') return 'status-away';
    if (normalizedStatus === 'paused') return 'status-paused';
    return 'status-offline';
  };

  const isStartDisabled = !task.trim() || normalizedStatus === 'online' || normalizedStatus === 'away';
  const isPauseDisabled = normalizedStatus !== 'online' && normalizedStatus !== 'away';
  const isFinishDisabled = normalizedStatus === 'offline';

  const postStatusUpdate = async (nextStatus) => {
    const token = window.localStorage.getItem('token');
    if (!token) {
      console.warn('No token found for status update');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tracker/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          task: task || ''
        })
      });

      if (!res.ok) {
        console.error('Failed to update status', await res.text());
        return;
      }

      const data = await res.json();
      // Map human-readable status from server back to UI status keys
      const serverStatus = (data.status || '').toLowerCase();
      if (serverStatus === 'online') {
        onStatusChange('online');
      } else if (serverStatus === 'away') {
        onStatusChange('away');
      } else if (serverStatus === 'paused') {
        onStatusChange('paused');
      } else {
        onStatusChange('offline');
      }
    } catch (err) {
      console.error('Error updating status', err);
    }
  };

  const handleStart = async () => {
    if (isStartDisabled) return;
    if (taskId) {
      try {
        const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${window.localStorage.getItem('token')}`
          }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('Aspro: не удалось перевести задачу в «В работе»', data.message || res.status);
          return;
        }
      } catch (err) {
        console.error('Error calling tasks/start', err);
        return;
      }
    }
    postStatusUpdate('Online');
  };

  const handlePause = () => {
    if (isPauseDisabled) return;
    postStatusUpdate('Paused');
  };

  const handleFinish = () => {
    if (isFinishDisabled) return;
    postStatusUpdate('Offline');
  };

  return (
    <div>
      <div className="tracker-controls">
        <div className={`status-pill ${getStatusClass()} ${(normalizedStatus === 'online' || normalizedStatus === 'away') ? 'btn-status-online' : ''}`}>
          <span className="status-dot" />
          <span className="status-label">{getStatusText()}</span>
        </div>

        <div className="tracker-buttons">
          <button
            className="btn btn-primary btn-small"
            onClick={handleStart}
            disabled={isStartDisabled}
          >
            Начать
          </button>
          <button
            className="btn btn-secondary btn-small"
            onClick={handlePause}
            disabled={isPauseDisabled}
          >
            Пауза
          </button>
          <button
            className="btn btn-danger btn-small"
            onClick={handleFinish}
            disabled={isFinishDisabled}
          >
            Завершить
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="current-task-label">Текущая задача</div>
        <div className="current-task-value">
          {task.trim() ? task : 'Нет активной задачи'}
        </div>
      </div>
    </div>
  );
}

export default TrackerPanel;

