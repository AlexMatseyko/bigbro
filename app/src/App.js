import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import AuthForm from './components/AuthForm';
import TrackerPanel from './components/TrackerPanel';
import TaskSelector from './components/TaskSelector';
import TaskActionsPanel from './components/TaskActionsPanel';
import CompletedTodayList from './components/CompletedTodayList';
import ProfileModal from './components/ProfileModal';
import ManagerPasswordModal from './components/ManagerPasswordModal';
import ManagerDashboard from './components/ManagerDashboard';
import PageTables from './components/PageTables';
import PageStats from './components/PageStats';
import PageFaq from './components/PageFaq';
import { API_BASE } from './config';

const PAGES = { home: 'home', tables: 'tables', stats: 'stats', faq: 'faq' };

const ONLINE_TIME_INTERVAL_MS = 60000; // отправлять счётчик раз в минуту

const STORAGE_KEY_STATUS = 'team-tracker-status';
const STORAGE_KEY_TASK = 'team-tracker-task';
const STORAGE_KEY_TASK_ID = 'team-tracker-taskId';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [task, setTask] = useState('');
  const [taskId, setTaskId] = useState(null); // ID задачи в Aspro для API «В работе»
  const [status, setStatus] = useState('offline'); // 'offline' | 'online' | 'away' | 'paused'
  const [completedTodayRefresh, setCompletedTodayRefresh] = useState(0);
  const [showManagerDashboard, setShowManagerDashboard] = useState(false);
  const [showManagerPasswordModal, setShowManagerPasswordModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(PAGES.home);
  const onlineSinceRef = useRef(null);
  const onlineIntervalRef = useRef(null);

  // Autologin using stored JWT
  useEffect(() => {
    const validateToken = async () => {
      const t = window.localStorage.getItem('token');
      if (!t) return;
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${t}` }
        });

        if (!res.ok) {
          window.localStorage.removeItem('token');
          return;
        }

        const data = await res.json();
        const fullName = `${data.last_name} ${data.first_name}`;
        setUserName(fullName);
        setIsLoggedIn(true);
        // Восстановление статуса и задачи после рефреша
        const savedStatus = window.localStorage.getItem(STORAGE_KEY_STATUS);
        const savedTask = window.localStorage.getItem(STORAGE_KEY_TASK);
        const savedTaskId = window.localStorage.getItem(STORAGE_KEY_TASK_ID);
        if (savedStatus && ['offline', 'online', 'away', 'paused'].includes(savedStatus)) {
          setStatus(savedStatus);
        } else {
          setStatus('offline');
        }
        setTask(savedTask != null ? savedTask : '');
        setTaskId(savedTaskId != null && savedTaskId !== '' ? savedTaskId : null);
        fetchProfileAvatar(t).then(setUserAvatar);
      } catch (err) {
        console.error('Failed to validate token', err);
        window.localStorage.removeItem('token');
      }
    };

    validateToken();
  }, []);

  const fetchProfileAvatar = (tok) => {
    const t = tok || window.localStorage.getItem('token');
    if (!t) return Promise.resolve(null);
    return fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((p) => (p && p.avatar) ? p.avatar : null)
      .catch(() => null);
  };

  const handleLogin = async ({ email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message =
          errorBody.message || 'Не удалось выполнить вход.';
        return { success: false, message };
      }

      const data = await res.json();
      window.localStorage.setItem('token', data.token);

      if (data.user) {
        const fullName = `${data.user.last_name} ${data.user.first_name}`;
        setUserName(fullName);
      } else {
        setUserName('');
      }
      setIsLoggedIn(true);
      setStatus('offline');
      fetchProfileAvatar(data.token).then(setUserAvatar);
      return { success: true };
    } catch (err) {
      console.error('Login error', err);
      return {
        success: false,
        message: 'Не удалось подключиться к серверу.'
      };
    }
  };

  const handleRegister = async ({
    lastName,
    firstName,
    email,
    password,
    department
  }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          department,
          email,
          password
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message =
          errorBody.message || 'Не удалось выполнить регистрацию.';
        return { success: false, message };
      }

      const data = await res.json();
      window.localStorage.setItem('token', data.token);

      if (data.user) {
        const fullName = `${data.user.last_name} ${data.user.first_name}`;
        setUserName(fullName);
      } else {
        setUserName('');
      }

      setIsLoggedIn(true);
      setStatus('offline');
      fetchProfileAvatar(data.token).then(setUserAvatar);
      return { success: true };
    } catch (err) {
      console.error('Register error', err);
      return {
        success: false,
        message: 'Не удалось подключиться к серверу.'
      };
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUserName('');
    setUserAvatar(null);
    setProfileOpen(false);
    setTask('');
    setTaskId(null);
    setStatus('offline');
    window.localStorage.removeItem(STORAGE_KEY_STATUS);
    window.localStorage.removeItem(STORAGE_KEY_TASK);
    window.localStorage.removeItem(STORAGE_KEY_TASK_ID);
  };

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    if (nextStatus === 'offline') {
      setTask('');
      setTaskId(null);
    }
  };

  const updateServerStatus = async (nextStatus, currentTask) => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/tracker/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus, task: currentTask || '' }),
      });
      if (!res.ok) {
        console.warn('Idle/activity status update failed', await res.text());
      }
    } catch (err) {
      console.error('Failed to update status (idle/activity)', err);
    }
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const onIdle = () => {
      setStatus((s) => {
        if (s !== 'online') return s;
        updateServerStatus('Away', task);
        return 'away';
      });
    };
    const onActivity = () => {
      setStatus((s) => {
        if (s !== 'away') return s;
        updateServerStatus('Online', task);
        return 'online';
      });
    };
    api.onIdleTimeout(onIdle);
    api.onUserActivity(onActivity);
  }, [task]);

  // Учёт времени в сети за день (МСК): при статусе online раз в минуту отправляем секунды на сервер
  const sendOnlineSeconds = (seconds) => {
    const token = window.localStorage.getItem('token');
    if (!token || seconds <= 0) return;
    fetch(`${API_BASE}/tracker/online-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ seconds })
    }).catch((err) => console.warn('Online time update failed', err));
  };

  useEffect(() => {
    if (status !== 'online') {
      if (onlineIntervalRef.current) {
        clearInterval(onlineIntervalRef.current);
        onlineIntervalRef.current = null;
      }
      if (onlineSinceRef.current != null) {
        const elapsed = Math.floor((Date.now() - onlineSinceRef.current) / 1000);
        if (elapsed > 0) sendOnlineSeconds(elapsed);
        onlineSinceRef.current = null;
      }
      return;
    }
    onlineSinceRef.current = Date.now();
    onlineIntervalRef.current = setInterval(() => {
      if (onlineSinceRef.current == null) return;
      const elapsed = Math.floor((Date.now() - onlineSinceRef.current) / 1000);
      onlineSinceRef.current = Date.now();
      if (elapsed > 0) sendOnlineSeconds(elapsed);
    }, ONLINE_TIME_INTERVAL_MS);
    return () => {
      if (onlineIntervalRef.current) clearInterval(onlineIntervalRef.current);
    };
  }, [status]);

  // Сохраняем статус и задачу в localStorage при изменении (для восстановления после рефреша)
  useEffect(() => {
    if (!isLoggedIn) return;
    window.localStorage.setItem(STORAGE_KEY_STATUS, status);
    window.localStorage.setItem(STORAGE_KEY_TASK, task || '');
    window.localStorage.setItem(STORAGE_KEY_TASK_ID, taskId != null ? String(taskId) : '');
  }, [isLoggedIn, status, task, taskId]);

  const MANAGER_PASSWORD = 'SecretShkolkovo';

  // Если открыт Dashboard руководителей — показываем только его
  if (showManagerDashboard) {
    return (
      <div className="app-root">
        <ManagerDashboard
          onBack={() => setShowManagerDashboard(false)}
          managerSecret={MANAGER_PASSWORD}
        />
      </div>
    );
  }

  return (
    <div className="app-root">
      {!isLoggedIn ? (
        <div className="auth-container">
          <div className="auth-center">
            <div className="card">
              <h1 className="app-title">Большой Брат</h1>
              <p className="app-subtitle">
                Отслеживайте свою работу с лёгкостью.
              </p>
              <AuthForm onLogin={handleLogin} onRegister={handleRegister} />
            </div>
          </div>
          <footer className="app-footer-manager">
            <button
              type="button"
              className="btn btn-ghost btn-manager-link"
              onClick={() => setShowManagerPasswordModal(true)}
            >
              Для руководителей
            </button>
          </footer>
        </div>
      ) : (
        <div className="tracker-container">
          <header className="app-header">
            <div className="top-bar">
              <div className="top-bar-title-wrap">
                <h1 className="app-title app-title-main">Большой Брат</h1>
                <span className="app-title-by">by Школково</span>
              </div>
              <div className="top-bar-right">
                <button
                  type="button"
                  className="user-trigger"
                  onClick={() => setProfileOpen(true)}
                  aria-label="Открыть профиль"
                >
                  <span className="header-avatar">
                    {userAvatar ? (
                      <img src={userAvatar.startsWith('http') ? userAvatar : `${API_BASE}${userAvatar}`} alt="" />
                    ) : (
                      <span className="header-avatar-placeholder">
                        {userName ? userName.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?' : '?'}
                      </span>
                    )}
                  </span>
                  <span className="user-name">{userName}</span>
                </button>
                <button className="btn btn-ghost btn-logout" onClick={handleLogout}>
                  Выход
                </button>
              </div>
            </div>
            <nav className="app-nav" aria-label="Основная навигация">
              <button
                type="button"
                className={`app-nav-btn ${currentPage === PAGES.home ? 'active' : ''}`}
                onClick={() => setCurrentPage(PAGES.home)}
              >
                Главная
              </button>
              <button
                type="button"
                className={`app-nav-btn ${currentPage === PAGES.tables ? 'active' : ''}`}
                onClick={() => setCurrentPage(PAGES.tables)}
              >
                Таблицы
              </button>
              <button
                type="button"
                className={`app-nav-btn ${currentPage === PAGES.stats ? 'active' : ''}`}
                onClick={() => setCurrentPage(PAGES.stats)}
              >
                Статистика
              </button>
              <button
                type="button"
                className={`app-nav-btn ${currentPage === PAGES.faq ? 'active' : ''}`}
                onClick={() => setCurrentPage(PAGES.faq)}
              >
                FAQ / Поддержка
              </button>
            </nav>
          </header>

          <ProfileModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            status={status}
            token={window.localStorage.getItem('token')}
            onAvatarChange={setUserAvatar}
          />

          <main className="tracker-main">
            {currentPage === PAGES.home && (
              <>
                <section className="card tracker-card">
                  <TaskSelector
                    task={task}
                    onTaskChange={(label, id) => {
                      setTask(typeof label === 'string' ? label : '');
                      setTaskId(id ?? null);
                    }}
                  />
                  <TrackerPanel
                    task={task}
                    taskId={taskId}
                    status={status}
                    onStatusChange={handleStatusChange}
                  />
                </section>
                <TaskActionsPanel
                  taskId={taskId}
                  onSendSuccess={() => {
                    setTask('');
                    setTaskId(null);
                    setCompletedTodayRefresh((n) => n + 1);
                  }}
                />
                <CompletedTodayList refreshTrigger={completedTodayRefresh} />
              </>
            )}
            {currentPage === PAGES.tables && <PageTables />}
            {currentPage === PAGES.stats && <PageStats />}
            {currentPage === PAGES.faq && <PageFaq />}
          </main>
          <footer className="app-footer-manager">
            <button
              type="button"
              className="btn btn-ghost btn-manager-link"
              onClick={() => setShowManagerPasswordModal(true)}
            >
              Для руководителей
            </button>
          </footer>
        </div>
      )}

      <ManagerPasswordModal
        open={showManagerPasswordModal}
        onClose={() => setShowManagerPasswordModal(false)}
        onSuccess={() => setShowManagerDashboard(true)}
        expectedPassword={MANAGER_PASSWORD}
      />
    </div>
  );
}

export default App;
