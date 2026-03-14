import React, { useState } from 'react';

function AuthForm({ onLogin, onRegister }) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmitLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    const result = await onLogin({ email, password });
    if (result && !result.success) {
      setError(result.message || 'Не удалось выполнить вход.');
    }
  };

  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    if (!lastName || !firstName || !email || !password || !department) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }

    // Простая проверка формата эл. почты
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Введите корректный адрес эл. почты.');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }

    setError('');
    const result = await onRegister({
      lastName,
      firstName,
      email,
      password,
      department
    });
    if (result && !result.success) {
      setError(result.message || 'Не удалось выполнить регистрацию.');
    }
  };

  return (
    <form
      className="form"
      onSubmit={isRegistering ? handleSubmitRegister : handleSubmitLogin}
    >
      {isRegistering && (
        <>
          <div className="form-row">
            <label className="label" htmlFor="lastName">
              Фамилия
            </label>
            <input
              id="lastName"
              type="text"
              className="input"
              placeholder="Иванов"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="firstName">
              Имя
            </label>
            <input
              id="firstName"
              type="text"
              className="input"
              placeholder="Иван"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
        </>
      )}

      <div className="form-row">
        <label className="label" htmlFor="email">
          Эл. почта
        </label>
        <input
          id="email"
          type="email"
          className="input"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          className="input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
        />
      </div>

      {isRegistering && (
        <div className="form-row">
          <label className="label" htmlFor="department">
            Отдел работы
          </label>
          <input
            id="department"
            type="text"
            className="input"
            placeholder="Например, Отдел разработки"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            autoComplete="organization"
          />
        </div>
      )}

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <div className="btn-row">
        {!isRegistering && (
          <>
            <button type="submit" className="btn btn-primary">
              Вход
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setError('');
                setIsRegistering(true);
              }}
            >
              Регистрация
            </button>
          </>
        )}

        {isRegistering && (
          <>
            <button type="submit" className="btn btn-primary">
              Регистрация
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setError('');
                setIsRegistering(false);
              }}
            >
              Назад
            </button>
          </>
        )}
      </div>
    </form>
  );
}

export default AuthForm;
