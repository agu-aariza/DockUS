import type { ExecutionContext } from '@nestjs/common';
import {
  authThrottleOverrides,
  throttlerConfig,
  trackByAuthIdentity,
  trackByRefreshToken,
  trackByUserOrIp,
} from './throttler.config';

function bucket(name: string) {
  const found = throttlerConfig.find((entry) => entry.name === name);
  if (!found) {
    throw new Error(`Cubo no configurado: ${name}`);
  }
  return found;
}

function contextWith(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body, ip: '10.0.0.1' }) }),
  } as unknown as ExecutionContext;
}

describe('throttlerConfig — ESC-C02: conteo por identidad, no por IP', () => {
  describe('trackByUserOrIp', () => {
    it('cuenta por usuario cuando la petición está autenticada', () => {
      // Es el cambio de fondo: un aula tras el NAT del campus comparte IP, y
      // con conteo por dirección el undécimo alumno no podía ni autenticarse.
      expect(trackByUserOrIp({ ip: '10.0.0.1', user: { userId: 'u-1' } })).toBe(
        'user:u-1',
      );
    });

    it('cae a la IP cuando no hay identidad', () => {
      expect(trackByUserOrIp({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
    });

    it('dos usuarios distintos tras la misma IP no comparten cuota', () => {
      const a = trackByUserOrIp({ ip: '10.0.0.1', user: { userId: 'u-1' } });
      const b = trackByUserOrIp({ ip: '10.0.0.1', user: { userId: 'u-2' } });

      expect(a).not.toBe(b);
    });

    it('prefiere la primera dirección de la cadena de proxies', () => {
      expect(trackByUserOrIp({ ip: '172.16.0.1', ips: ['203.0.113.9'] })).toBe(
        'ip:203.0.113.9',
      );
    });
  });

  describe('trackByAuthIdentity', () => {
    it('cuenta por correo, de modo que rotar de IP no renueva la cuota', () => {
      const desdeUnaIp = trackByAuthIdentity({
        ip: '10.0.0.1',
        body: { email: 'alumno@uni.test' },
      });
      const desdeOtraIp = trackByAuthIdentity({
        ip: '198.51.100.7',
        body: { email: 'alumno@uni.test' },
      });

      expect(desdeUnaIp).toBe('email:alumno@uni.test');
      expect(desdeOtraIp).toBe(desdeUnaIp);
    });

    it('normaliza mayúsculas y espacios para no multiplicar la cuota', () => {
      expect(
        trackByAuthIdentity({ body: { email: '  Alumno@UNI.test ' } }),
      ).toBe('email:alumno@uni.test');
    });

    it('degrada a IP si el cuerpo no trae correo', () => {
      expect(trackByAuthIdentity({ ip: '10.0.0.1', body: {} })).toBe(
        'ip:10.0.0.1',
      );
    });
  });

  describe('trackByRefreshToken', () => {
    it('cuenta por el refresh token, no por IP, cuando está presente', () => {
      const desdeUnaIp = trackByRefreshToken({
        ip: '10.0.0.1',
        body: { refreshToken: 'a-refresh-token' },
      });
      const desdeOtraIp = trackByRefreshToken({
        ip: '198.51.100.7',
        body: { refreshToken: 'a-refresh-token' },
      });

      expect(desdeUnaIp).toBe(desdeOtraIp);
      expect(desdeUnaIp).not.toContain('a-refresh-token');
    });

    it('dos refresh tokens distintos no comparten cuota', () => {
      const a = trackByRefreshToken({ body: { refreshToken: 'token-a' } });
      const b = trackByRefreshToken({ body: { refreshToken: 'token-b' } });

      expect(a).not.toBe(b);
    });

    it('degrada a IP si el cuerpo no trae refreshToken', () => {
      expect(trackByRefreshToken({ ip: '10.0.0.1', body: {} })).toBe(
        'ip:10.0.0.1',
      );
    });
  });

  describe('cubo refresh-identity (INF-002)', () => {
    it('se salta cuando la petición no lleva refreshToken', () => {
      const skipIf = bucket('refresh-identity').skipIf;

      expect(skipIf?.(contextWith({}))).toBe(true);
      expect(skipIf?.(contextWith(undefined))).toBe(true);
    });

    it('interviene cuando la petición lleva refreshToken — antes /auth/refresh no tenía ningún cubo por identidad', () => {
      const skipIf = bucket('refresh-identity').skipIf;

      expect(skipIf?.(contextWith({ refreshToken: 'a-refresh-token' }))).toBe(
        false,
      );
    });

    it('mantiene un límite estricto equivalente a auth-identity', () => {
      expect(bucket('refresh-identity').limit).toBeLessThanOrEqual(10);
    });
  });

  describe('cubo auth-identity', () => {
    it('se salta cuando la petición no lleva correo', () => {
      const skipIf = bucket('auth-identity').skipIf;

      expect(skipIf?.(contextWith({}))).toBe(true);
      expect(skipIf?.(contextWith(undefined))).toBe(true);
    });

    it('interviene cuando la petición lleva correo', () => {
      const skipIf = bucket('auth-identity').skipIf;

      expect(skipIf?.(contextWith({ email: 'a@b.test' }))).toBe(false);
    });

    it('mantiene un límite estricto: es la defensa real ante fuerza bruta', () => {
      expect(bucket('auth-identity').limit).toBeLessThanOrEqual(10);
    });
  });

  describe('overrides de autenticación', () => {
    it('permite un aula completa desde una sola dirección', () => {
      // 200 alumnos tras el mismo NAT deben poder iniciar sesión.
      expect(authThrottleOverrides.global.limit).toBeGreaterThanOrEqual(200);
    });

    it('no relaja el cubo por correo, que no figura entre los overrides', () => {
      expect(Object.keys(authThrottleOverrides)).not.toContain('auth-identity');
    });
  });

  describe('reparto de responsabilidades entre config y guard', () => {
    it('auth-identity resuelve su clave en la configuración', () => {
      // No necesita inyección de dependencias: la clave sale del cuerpo.
      expect(typeof bucket('auth-identity').getTracker).toBe('function');
    });

    it.each(['global', 'burst'])(
      'el cubo %s delega su clave en DockusThrottlerGuard',
      (name) => {
        // Verificado empíricamente: `req.user` no existe cuando corre el guard
        // global, así que la identidad hay que resolverla verificando el token,
        // y un getTracker de configuración no tiene acceso a ConfigService.
        expect(bucket(name).getTracker).toBeUndefined();
      },
    );
  });
});
