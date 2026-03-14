import React, { useState, useEffect } from 'react';

import { API_BASE } from '../config';

const STATUS_LABELS = {
  Online: 'В сети',
  Away: 'Отошёл',
  Offline: 'Не в сети',
  Paused: 'Пауза',
  online: 'В сети',
  away: 'Отошёл',
  offline: 'Не в сети',
  paused: 'Пауза'
};

function getStatusClass(status) {
  const s = (status || '').toString().toLowerCase();
  if (s === 'online') return 'status-online';
  if (s === 'away') return 'status-away';
  if (s === 'paused') return 'status-paused';
  return 'status-offline';
}

function getStatusPillClass(status) {
  const s = (status || '').toString().toLowerCase();
  const withGreen = s === 'online' || s === 'away' ? ' btn-status-online' : '';
  return `status-pill ${getStatusClass(status)}${withGreen}`;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'free', label: 'Свободен' },
  { value: 'online', label: 'В сети' },
  { value: 'away', label: 'Отошёл' },
  { value: 'offline', label: 'Не в сети' },
  { value: 'paused', label: 'Пауза' }
];

function ManagerDashboard({ onBack, managerSecret }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!managerSecret) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/manager/employees`, {
      headers: { 'X-Manager-Secret': managerSecret }
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Доступ запрещён' : 'Ошибка загрузки');
        return res.json();
      })
      .then((data) => {
        setEmployees(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message || 'Не удалось загрузить список'))
      .finally(() => setLoading(false));
  }, [managerSecret]);

  const statusLabel = (s) => (s != null && s !== '' ? (STATUS_LABELS[s] || (typeof s === 'string' ? s : '—')) : '—');
  const taskLabel = (t) => (t != null && t !== '' ? t : '—');
  const formatLastSeen = (emp) => {
    const status = (emp.status || '').toString().toLowerCase();
    if (status === 'online' || status === 'away') return 'Сейчас';
    const dateStr = emp.last_seen_at;
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}, ${h}:${m}`;
  };
  const fullName = (emp) => {
    const ln = (emp.last_name || '').trim();
    const fn = (emp.first_name || '').trim();
    return [ln, fn].filter(Boolean).join(' ') || '—';
  };

  const filteredEmployees = employees.filter((emp) => {
    const name = fullName(emp).toLowerCase();
    const search = nameSearch.trim().toLowerCase();
    if (search && !name.includes(search)) return false;

    const status = (emp.status || '').toString().toLowerCase();
    const task = (emp.task || '').toString().trim();

    if (statusFilter === 'all') return true;
    if (statusFilter === 'free') {
      return (status === 'online' || status === 'away') && !task;
    }
    return status === statusFilter;
  });

  return (
    <div className="manager-dashboard">
      <header className="manager-dashboard-header">
        <h1 className="manager-dashboard-title">Dashboard для руководителей</h1>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Вернуться в приложение
        </button>
      </header>
      <main className="manager-dashboard-main">
        <section className="manager-block manager-employees">
          <h2 className="manager-block-title">Список сотрудников</h2>
          {loading && <p className="manager-block-loading">Загрузка…</p>}
          {error && <p className="manager-block-error">{error}</p>}
          {!loading && !error && (
            <>
              <div className="manager-filters">
                <input
                  type="text"
                  className="input manager-filter-search"
                  placeholder="Поиск по имени"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  aria-label="Поиск по имени"
                />
                <select
                  className="input manager-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Фильтр по статусу"
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="manager-table-wrap">
                <table className="manager-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Статус</th>
                      <th>Последний раз в сети</th>
                      <th>Задача</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="manager-table-empty">
                          {employees.length === 0 ? 'Нет сотрудников' : 'Никого не найдено'}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>{fullName(emp)}</td>
                        <td>
                          <div className={getStatusPillClass(emp.status)}>
                            <span className="status-dot" />
                            <span className="status-label">{statusLabel(emp.status)}</span>
                          </div>
                        </td>
                        <td className="manager-table-last-seen">{formatLastSeen(emp)}</td>
                        <td className="manager-table-task">{taskLabel(emp.task)}</td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default ManagerDashboard;
