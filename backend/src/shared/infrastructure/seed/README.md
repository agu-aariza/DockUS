# Siembra de Datos Iniciales (shared/infrastructure/seed)

> **Resumen rápido:** Servicios de siembra (seeding) de datos ficticios (demo) y de administración para entornos de desarrollo y pruebas.

---

## Propósito y Responsabilidades
Poblar la base de datos con información inicial necesaria para el funcionamiento de la aplicación en entornos dev.
- **Admin Seeding:** Creación del usuario administrador inicial.
- **Demo Seeding:** Creación de usuarios, grupos y entregas de demostración.

---

## Estructura Interna

```text
.
├── admin-seed.service.ts # Servicio de siembra del usuario administrador
└── demo-seed.service.ts  # Servicio de siembra de datos de prueba completos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Process Role Boot ] ──> (Si DB está vacía) ──> [ AdminSeedService / DemoSeedService ] ──> [ PostgreSQL ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de seeding:
```bash
npm run test -- src/shared/infrastructure/seed
```
