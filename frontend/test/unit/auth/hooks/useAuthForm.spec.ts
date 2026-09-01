import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/auth/api/authApi", () => ({
  authApi: { login: vi.fn(), register: vi.fn() },
}));

import { authApi } from "@/auth/api/authApi";
import { useAuthForm } from "@/auth/hooks/useAuthForm";

const AUTH_RESPONSE = {
  user: { id: "user-1", email: "alumno@educodeai.local", role: "STUDENT" },
  accessToken: "access-token",
  refreshToken: "refresh-token",
} as const;

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
}

describe("useAuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in LOGIN mode with empty, untouched validation", () => {
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    expect(result.current.mode).toBe("LOGIN");
    expect(result.current.validation.email.touched).toBe(false);
    expect(result.current.message).toBe("");
  });

  it("blur validation flags an invalid email and a too-short password", () => {
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    act(() => {
      result.current.setForm((prev) => ({ ...prev, email: "not-an-email", password: "short" }));
    });
    act(() => {
      result.current.handleBlur("email");
      result.current.handleBlur("password");
    });

    expect(result.current.validation.email).toMatchObject({
      touched: true,
      valid: false,
      message: "Formato de correo inválido",
    });
    expect(result.current.validation.password).toMatchObject({
      touched: true,
      valid: false,
      message: "Mínimo 8 caracteres",
    });
  });

  it("login success calls onAuthSuccess with the response and shows a success message", async () => {
    vi.mocked(authApi.login).mockResolvedValue(AUTH_RESPONSE as any);
    const onAuthSuccess = vi.fn();
    const { result } = renderHook(() => useAuthForm(onAuthSuccess));

    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        email: "alumno@educodeai.local",
        password: "correcthorsebattery",
      }));
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "alumno@educodeai.local",
      password: "correcthorsebattery",
    });
    expect(onAuthSuccess).toHaveBeenCalledWith(AUTH_RESPONSE);
    expect(result.current.isErrorMessage).toBe(false);
    expect(result.current.message).toContain("alumno@educodeai.local");
    expect(result.current.loading).toBeNull();
  });

  it("login failure surfaces the backend message, triggers the shake animation, and never calls onAuthSuccess", async () => {
    // http.ts ya normaliza el error de axios a {statusCode,error,message}
    // antes de que llegue aquí (ver normalizeApiError) — getErrorMessage lee
    // ese shape plano, no error.response.data.
    vi.mocked(authApi.login).mockRejectedValue({
      message: "Credenciales inválidas",
    });
    const onAuthSuccess = vi.fn();
    const { result } = renderHook(() => useAuthForm(onAuthSuccess));

    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        email: "alumno@educodeai.local",
        password: "wrongpassword",
      }));
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(result.current.message).toBe("Credenciales inválidas");
    expect(result.current.isErrorMessage).toBe(true);
    expect(result.current.shakeForm).toBe(true);
  });

  it("register mode calls authApi.register with the full form and reports the created account", async () => {
    vi.mocked(authApi.register).mockResolvedValue(AUTH_RESPONSE as any);
    const onAuthSuccess = vi.fn();
    const { result } = renderHook(() => useAuthForm(onAuthSuccess));

    act(() => {
      result.current.handleModeSwitch("REGISTER");
    });
    act(() => {
      result.current.setForm({
        email: "alumno@educodeai.local",
        // Cumple el contrato de `RegisterDto`: 8+, mayúscula, minúscula y dígito.
        password: "Correcthorse1",
        confirmPassword: "Correcthorse1",
        firstName: "Ana",
        lastName: "García",
      });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(authApi.register).toHaveBeenCalledWith({
      email: "alumno@educodeai.local",
      password: "Correcthorse1",
      firstName: "Ana",
      lastName: "García",
    });
    expect(onAuthSuccess).toHaveBeenCalledWith(AUTH_RESPONSE);
  });

  it("register blocks a password the backend would reject, without calling the API", async () => {
    const onAuthSuccess = vi.fn();
    const { result } = renderHook(() => useAuthForm(onAuthSuccess));

    act(() => {
      result.current.handleModeSwitch("REGISTER");
    });
    act(() => {
      result.current.setForm({
        email: "alumno@educodeai.local",
        // Larga, pero sin mayúscula ni dígito ni carácter especial: el
        // `Matches` de `RegisterDto` la rechaza con un 400.
        password: "correcthorsebattery",
        confirmPassword: "correcthorsebattery",
        firstName: "Ana",
        lastName: "García",
      });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(authApi.register).not.toHaveBeenCalled();
    expect(result.current.validation.password).toMatchObject({
      touched: true,
      valid: false,
    });
  });

  it("login never demands password complexity", () => {
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    act(() => {
      result.current.setForm((prev) => ({ ...prev, password: "correcthorsebattery" }));
    });
    act(() => {
      result.current.handleBlur("password");
    });

    // Las cuentas anteriores a la regla deben poder seguir entrando.
    expect(result.current.validation.password).toMatchObject({ valid: true });
  });

  it("switching modes clears the message and resets touched validation", async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      message: "Credenciales inválidas",
    });
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    act(() => {
      result.current.handleBlur("email");
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(result.current.message).not.toBe("");
    expect(result.current.validation.email.touched).toBe(true);

    act(() => {
      result.current.handleModeSwitch("REGISTER");
    });

    expect(result.current.message).toBe("");
    expect(result.current.validation.email.touched).toBe(false);
  });

  it("submit with invalid fields blocks the API call, flags every field, and reports the error", async () => {
    const onAuthSuccess = vi.fn();
    const { result } = renderHook(() => useAuthForm(onAuthSuccess));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(authApi.login).not.toHaveBeenCalled();
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(result.current.message).toBe("Revisa los campos marcados antes de continuar.");
    expect(result.current.isErrorMessage).toBe(true);
    expect(result.current.validation.email.touched).toBe(true);
    expect(result.current.validation.password.touched).toBe(true);
    expect(result.current.shakeForm).toBe(true);
  });

  it("register with mismatching passwords never reaches the API", async () => {
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    act(() => {
      result.current.handleModeSwitch("REGISTER");
    });
    act(() => {
      result.current.setForm({
        email: "alumno@educodeai.local",
        password: "correcthorsebattery",
        confirmPassword: "differentpassword",
        firstName: "Ana",
        lastName: "García",
      });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(authApi.register).not.toHaveBeenCalled();
    expect(result.current.validation.confirmPassword).toMatchObject({
      touched: true,
      valid: false,
      message: "Las contraseñas no coinciden",
    });
  });

  it("updateField revalidates a touched field live as the user fixes it", () => {
    const { result } = renderHook(() => useAuthForm(vi.fn()));

    act(() => {
      result.current.updateField("email", "not-an-email");
    });
    act(() => {
      result.current.handleBlur("email");
    });
    expect(result.current.validation.email.valid).toBe(false);

    act(() => {
      result.current.updateField("email", "alumno@educodeai.local");
    });
    expect(result.current.validation.email).toMatchObject({
      touched: true,
      valid: true,
    });
  });
});
