import React, { useEffect, useState, useCallback } from 'react';
import TaskSelectModal, { getTaskLabel, getDisplayStatusTitle } from './TaskSelectModal';

import { API_BASE } from '../config';
const TASKS_REFRESH_INTERVAL_MS = 60000; // обновление списка каждые 60 секунд

/** Виртуальная задача «Свободен» — не привязана к Аспро, только индикатор. */
const FREE_TASK = { id: null, name: 'Свободен', title: 'Свободен', isFree: true };

function TaskSelector({ task, onTaskChange }) {
  const [asproTasks, setAsproTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadTasks = useCallback(async (silent = false) => {
    const token = window.localStorage.getItem('token');
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    const includeIds = params.get('includeTaskIds');
    const url = includeIds ? `${API_BASE}/tasks?includeTaskIds=${encodeURIComponent(includeIds)}` : `${API_BASE}/tasks`;

    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('Failed to load tasks from server', res.status, bodyText);
        if (!silent) setError('Не удалось загрузить задачи из Aspro Cloud.');
        return;
      }

      const data = await res.json();
      setAsproTasks(Array.isArray(data) ? data : []);
      setTasksLoaded(true);
    } catch (err) {
      console.error('Error loading tasks', err);
      if (!silent) setError('Ошибка связи с сервером задач.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Первая загрузка при монтировании
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Автообновление списка по интервалу (тихо, без индикатора загрузки)
  useEffect(() => {
    if (!tasksLoaded) return;
    const intervalId = setInterval(() => loadTasks(true), TASKS_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [tasksLoaded, loadTasks]);

  // Обновление при открытии модалки выбора задачи
  useEffect(() => {
    if (modalOpen) loadTasks(true);
  }, [modalOpen, loadTasks]);

  const selectedTask =
    task === 'Свободен' ? FREE_TASK : asproTasks.find((t) => getTaskLabel(t) === task);

  const handleSelectTask = (taskObj) => {
    if (taskObj) {
      onTaskChange(getTaskLabel(taskObj), taskObj.id ?? null);
    } else {
      onTaskChange('', null);
    }
  };

  const tasksWithFree = [FREE_TASK, ...asproTasks];

  return (
    <div className="task-row">
      <div className="form-row">
        <label className="label" htmlFor="task">
          Задача
        </label>
        <div className="task-input-row">
          {tasksLoaded ? (
            <button
              type="button"
              id="task"
              className="task-trigger"
              onClick={() => setModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={modalOpen}
            >
              <span className={selectedTask ? '' : 'task-trigger-placeholder'}>
                {selectedTask
                  ? (selectedTask.statusTitle
                      ? `${getTaskLabel(selectedTask)} — ${getDisplayStatusTitle(selectedTask.statusTitle)}`
                      : getTaskLabel(selectedTask))
                  : 'Выберите задачу'}
              </span>
              <svg className="task-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : (
            <input
              id="task"
              type="text"
              className="input"
              placeholder="Над чем вы сейчас работаете?"
              value={task}
              onChange={(e) => onTaskChange(e.target.value, null)}
            />
          )}
        </div>
      </div>

      <TaskSelectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tasks={tasksWithFree}
        selectedTask={selectedTask}
        onSelectTask={handleSelectTask}
      />

      {loading && <p className="task-helper">Загружаем задачи из Aspro Cloud…</p>}
      {error && <p className="task-helper error-text">{error}</p>}
      {!loading && !error && (
        <p className="task-helper">
          {tasksLoaded
            ? asproTasks.length > 0
              ? 'Нажмите, чтобы открыть окно выбора задачи из Aspro Cloud.'
              : 'Нет задач с подходящим статусом (Не начато, В работе, На проверке).'
            : 'Опишите, над чем собираетесь работать. Это поможет вашей команде видеть ваш фокус в реальном времени.'}
        </p>
      )}
    </div>
  );
}

export default TaskSelector;
