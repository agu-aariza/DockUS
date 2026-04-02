import { type FormEvent, useState } from 'react';
import { authApi } from '../shared/api/services';
import type { AuthResponse } from '../shared/types';
import { getErrorMessage } from '../shared/utils/errors';

interface AuthPanelProps {
  onAuthSuccess: (response: AuthResponse, label?: string) => void;
}

export function AuthPanel({ onAuthSuccess }: AuthPanelProps): JSX.Element {
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    sessionLabel: '',
  });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    sessionLabel: '',
  });
  const [loading, setLoading] = useState<'LOGIN' | 'REGISTER' | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading('LOGIN');
    setMessage('');
    try {
      const response = await authApi.login({
        email: loginForm.email,
        password: loginForm.password,
      });
      onAuthSuccess(response, loginForm.sessionLabel);
      setMessage(`Sesión iniciada para ${response.user.email}.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading('REGISTER');
    setMessage('');
    try {
      const response = await authApi.register({
        email: registerForm.email,
        password: registerForm.password,
        firstName: registerForm.firstName,
        lastName: registerForm.lastName,
      });
      onAuthSuccess(response, registerForm.sessionLabel);
      setMessage(`Usuario registrado y sesión creada para ${response.user.email}.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="grid two-col">
      <article className="card">
        <h3>Login</h3>
        <form className="form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              required
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, password: event.target.value }))
              }
            />
          </label>
          <label>
            Etiqueta de sesión (opcional)
            <input
              type="text"
              value={loginForm.sessionLabel}
              onChange={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  sessionLabel: event.target.value,
                }))
              }
              placeholder="Admin local, Student QA..."
            />
          </label>
          <button className="btn" type="submit" disabled={loading === 'LOGIN'}>
            {loading === 'LOGIN' ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </form>
      </article>

      <article className="card">
        <h3>Register</h3>
        <form className="form" onSubmit={handleRegister}>
          <label>
            Email
            <input
              type="email"
              required
              value={registerForm.email}
              onChange={(event) =>
                setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Nombre
            <input
              type="text"
              required
              value={registerForm.firstName}
              onChange={(event) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  firstName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Apellido
            <input
              type="text"
              required
              value={registerForm.lastName}
              onChange={(event) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  lastName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Etiqueta de sesión (opcional)
            <input
              type="text"
              value={registerForm.sessionLabel}
              onChange={(event) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  sessionLabel: event.target.value,
                }))
              }
            />
          </label>
          <button className="btn" type="submit" disabled={loading === 'REGISTER'}>
            {loading === 'REGISTER' ? 'Registrando...' : 'Registrar y entrar'}
          </button>
        </form>
      </article>

      {message ? <p className="message info full-width">{message}</p> : null}
    </section>
  );
}
