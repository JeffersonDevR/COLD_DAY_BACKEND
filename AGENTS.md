# AGENTS.md — léelo ANTES de tocar nada

Punto de entrada para cualquier agente/modelo/harness (Claude, Codex, Cursor, Copilot, etc.). `CLAUDE.md` apunta aquí. Este archivo es corto a propósito: las reglas completas viven en tres documentos que **debes leer** según lo que toques.

| Si vas a tocar… | Lee (obligatorio) | Backlog de tareas | Verificador ejecutable |
|---|---|---|---|
| UI / estilos / copy de `frontend/` | [`DESIGN.md`](DESIGN.md) + [`PRODUCT.md`](PRODUCT.md) | [`docs/design/TAREAS-UI.md`](docs/design/TAREAS-UI.md) | `cd frontend && npm run ui:check` |
| `backend/` (Java/Spring) | [`docs/backend/GUIA-BACKEND.md`](docs/backend/GUIA-BACKEND.md) + [`ARQUITECTURA.md`](ARQUITECTURA.md) | [`docs/backend/TAREAS-BACKEND.md`](docs/backend/TAREAS-BACKEND.md) | `node backend/scripts/check-backend-rules.mjs` |
| Cualquier otra cosa | `ARQUITECTURA.md`, `docs/pendientes.md` | — | — |

## Reglas que no se negocian

1. **Ejecuta el verificador antes y después.** Pega la salida en tu entrega. Si una regla «SUBIÓ», corrige el código. **Prohibido** subir un techo o editar a mano `frontend/scripts/ui-rules.baseline.json` / `backend/scripts/backend-rules.baseline.json`; solo se regeneran con `--update` y solo si **bajaron**.
2. **Una tarea = un commit = su Definición de hecho** (`DESIGN.md` §11 o `GUIA-BACKEND.md` §7), con cada casilla marcada y su evidencia. Sin evidencia no está hecho.
3. **Cambio mínimo.** No refactorices lo que no te pidieron, no reformatees archivos, no cambies dependencias, no toques `backend/` desde una tarea de UI ni viceversa.
4. **No saltes los controles:** nada de `--no-verify`, `-x test`, `@Disabled`, `eslint-disable`, `it.skip`, ni borrar o aflojar tests. Si un test falla, entiende por qué; cámbialo **solo** si la tarea cambia ese comportamiento y explícalo.
5. **Si una regla te parece equivocada, o dos documentos se contradicen: detente y pregunta.** No elijas por tu cuenta.
6. **No inventes** precios, SLA, políticas, métricas ni testimonios (ver `PRODUCT.md`). Copy en **tuteo**, español de Colombia.
7. **Árbol de trabajo sucio.** El repo tiene cambios sin commit de otras personas (incluidos `DESIGN.md`, `PRODUCT.md` y `docs/design/` que aún no están en git). **No los reviertas, no uses `git checkout -- .`, `git reset --hard` ni `git clean`.** Edita sobre ellos y deja el commit al humano si no te lo piden.
8. **Secretos.** Nunca los imprimas, copies al repo ni envíes a servicios externos. Las credenciales demo del seeder son solo para el backend **local**; nunca las uses contra un host que no sea `localhost`.
9. **Origen del backend móvil.** `frontend/.env` → `MOBILE_API_ORIGIN`. Si lo apuntas a `localhost` para probar, **restáuralo** (producción) antes de `mobile:build`, `mobile:apk` o `mobile:aab`.

## Comandos de verificación

```bash
# Frontend (desde frontend/)
npm run ui:check          # reglas de diseño (techos que solo bajan) + tokens
npm run mobile:test       # specs móviles (Vitest); ejecuta ui:check antes
npm run mobile:build      # compila móvil; ejecuta ui:check antes
npm run ui:audit          # render por tamaño con Playwright (requiere app y backend locales)

# Backend (desde backend/)
node scripts/check-backend-rules.mjs
./gradlew build --console=plain     # necesita Docker (Testcontainers/PostGIS)
```

Activa el hook una vez por clon: `git config core.hooksPath .githooks`. El CI (`.github/workflows/`) ejecuta lo mismo y bloquea el merge.

## Cómo trabajar con modelos pequeños

- Toma **una** tarea de `TAREAS-UI.md` / `TAREAS-BACKEND.md` (están ordenadas y son atómicas). No combines tareas.
- Lee solo las secciones que la tarea cita, pero lee **completo** el archivo de reglas correspondiente una vez.
- Trabaja en pasos pequeños; tras cada paso corre el verificador. Si fallas dos veces seguidas en lo mismo, detente y reporta con el error exacto en vez de improvisar.
- Formato de entrega: (1) qué cambiaste (archivos), (2) salida de los comandos de aceptación, (3) checklist de la Definición de hecho marcado, (4) lo que **no** pudiste verificar y por qué.

## Mapa del repositorio

```
backend/             Spring Boot 4 / Java 25 / PostGIS / Flyway        → docs/backend/
frontend/src         web consola (Angular 21, Tailwind v4, PrimeNG)
frontend/projects/mobile   app móvil (Ionic 9, Capacitor 8)            → DESIGN.md
docs/design/dark-ops       prototipos de pantalla (code.html, assets)  → ver docs/design/README.md
odd/                 tareas y auditorías históricas (contexto, no ley)
landing/             tienda estática (fuera del sistema de diseño)
```
