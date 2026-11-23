# AGENTS.md — léelo ANTES de tocar nada

Punto de entrada para cualquier agente/modelo/harness (Claude, Codex, Cursor, Copilot, etc.). `CLAUDE.md` apunta aquí. Este archivo es corto a propósito: las reglas completas viven en los documentos de la tabla y **debes leerlos** según lo que toques.

| Si vas a tocar… | Lee (obligatorio) | Backlog de tareas | Verificador ejecutable |
|---|---|---|---|
| UI / estilos / copy / pantallas de `frontend/` | [`DESIGN.md`](DESIGN.md) + [`PRODUCT.md`](PRODUCT.md) + [`docs/design/NAVEGACION.md`](docs/design/NAVEGACION.md) | [`docs/design/TAREAS-UI.md`](docs/design/TAREAS-UI.md) | `cd frontend && npm run ui:check` |
| `backend/` (Java/Spring) | [`docs/backend/GUIA-BACKEND.md`](docs/backend/GUIA-BACKEND.md) + [`ARQUITECTURA.md`](ARQUITECTURA.md) | [`docs/backend/TAREAS-BACKEND.md`](docs/backend/TAREAS-BACKEND.md) | `node backend/scripts/check-backend-rules.mjs` |
| Cualquier otra cosa | `ARQUITECTURA.md`, `docs/pendientes.md` | — | — |

## Reglas que no se negocian

1. **Ejecuta el verificador antes y después.** Pega la salida en tu entrega. Si una regla «SUBIÓ», corrige el código. **Prohibido** subir un techo o editar a mano `frontend/scripts/ui-rules.baseline.json` / `backend/scripts/backend-rules.baseline.json`; solo se regeneran con `--update` y solo si **bajaron**.
2. **Una tarea = un commit = su Definición de hecho** (`DESIGN.md` §11 o `GUIA-BACKEND.md` §7), con cada casilla marcada y su evidencia. Sin evidencia no está hecho.
3. **Cambio mínimo.** No refactorices lo que no te pidieron, no reformatees archivos, no cambies dependencias, no toques `backend/` desde una tarea de UI ni viceversa.
4. **No saltes los controles:** nada de `--no-verify`, `-x test`, `@Disabled`, `eslint-disable`, `it.skip`, ni borrar o aflojar tests. Si un test falla, entiende por qué; cámbialo **solo** si la tarea cambia ese comportamiento y explícalo.
5. **Si una regla te parece equivocada, o dos documentos se contradicen: detente y pregunta.** No elijas por tu cuenta.
6. **No inventes** precios, SLA, políticas, métricas ni testimonios (ver `PRODUCT.md`). Copy en **tuteo**, español de Colombia.
7. **No destruyas trabajo ajeno.** Puede haber cambios locales, notas sueltas (p. ej. `*.md` en la raíz) o archivos borrados sin commit. Nada de `git checkout -- .`, `git reset --hard` ni `git clean`. Deja el commit al humano salvo que te lo pidan; si commiteas, usa el estilo del repo: `tipo(ámbito): mensaje` en español (`feat(mobile): …`, `fix(ci): …`).
8. **Secretos.** Nunca los imprimas, copies al repo ni envíes a servicios externos. Las credenciales demo del seeder son solo para el backend **local**; nunca las uses contra un host que no sea `localhost`.
9. **Origen del backend móvil.** `frontend/.env` → `MOBILE_API_ORIGIN`. Si lo apuntas a `localhost` para probar, **restáuralo** (producción) antes de `mobile:build`, `mobile:apk` o `mobile:aab`.
10. **Flyway es append-only.** Una migración `V*.sql` ya aplicada **no se edita ni se borra** (el job `migrations-append-only` del CI lo bloquea; solo hay una excepción documentada, V12). Crea siempre una `V<nueva>__…sql`.
11. **Archivos generados, nunca a mano.** `frontend/src/app/core/environment/{api-origin,mobile-origin,maps-key}.ts` los escribe `npm run gen:config` (lo disparan los hooks `postinstall`/`prestart`/`prebuild`/`pretest`/`prelint`/`premobile:*`) y están en `.gitignore`. `API_ORIGIN` y `MOBILE_API_ORIGIN` llevan **solo el host**, sin path y sin `/api`; si no, el build corta a propósito.

## Puesta en marcha local

```bash
docker compose up -d db        # PostGIS 16 en 127.0.0.1:5433 (cold_day/cold_day)
cd backend
.\gradlew.bat bootRun          # perfil dev inyectado; puerto 8090
cd ../frontend
npm install                    # postinstall genera la config del build
npm start                      # puerto 4200; proxy /api -> localhost:8090
```

- Copia `backend/.env.example` a `backend/.env` solo si necesitas Maps/SMTP; en dev el resto tiene valores por defecto (y Spring carga ese `.env` si existe).
- **Auth apagada en local:** `DevAuthBypassFilter` ejecuta sin JWT como un usuario sembrado. Cambia de usuario con el header `X-Dev-Usuario: cliente1@coldday.com.co` (`tecnico1…`, `proveedor1…`, `admin…`, `contable…`). Password demo: `demo1234` (`APP_SEED_DEMO_PASSWORD`). Para probar la seguridad real: `DEV_AUTH_BYPASS=false` en `backend/.env`.
- El login tiene rate limit (10/min por IP): en pruebas reutiliza sesión, no inicies sesión en bucle.
- En el emulador/navegador móvil contra un backend local, sirve la app en **4200**: es el único origen web permitido por `CORS_ALLOWED_ORIGINS` en dev. La web no tiene problema porque en `ng serve` va por proxy.

## Comandos de verificación

```bash
# Frontend (desde frontend/)
npm run ui:check          # reglas de diseño (techos que solo bajan) + tokens
npm run mobile:test       # specs móviles (Vitest); ejecuta ui:check antes
npm run mobile:build      # compila móvil; ejecuta ui:check antes
npm run ui:audit          # render por tamaño con Playwright (requiere app y backend locales)
npx ng test app --watch=false    # solo specs web; sin proyecto corre web + móvil

# Backend (desde backend/)
node scripts/check-backend-rules.mjs
.\gradlew.bat build --console=plain            # build + suite completa; necesita Docker (Testcontainers/PostGIS)
.\gradlew.bat test --tests "*AceptarOferta*"   # un solo test
```

Activa el hook una vez por clon: `git config core.hooksPath .githooks`. El CI (`.github/workflows/`) ejecuta lo mismo y bloquea el merge. Sin perfil `dev`/`prod` activo el backend **no arranca** a propósito.

## Cómo trabajar con modelos pequeños

- Toma **una** tarea de `TAREAS-UI.md` / `TAREAS-BACKEND.md` (están ordenadas y son atómicas). No combines tareas.
- Lee solo las secciones que la tarea cita, pero lee **completo** el archivo de reglas correspondiente una vez.
- Trabaja en pasos pequeños; tras cada paso corre el verificador. Si fallas dos veces seguidas en lo mismo, detente y reporta con el error exacto en vez de improvisar.
- Formato de entrega: (1) qué cambiaste (archivos), (2) salida de los comandos de aceptación, (3) checklist de la Definición de hecho marcado, (4) lo que **no** pudiste verificar y por qué.

## Mapa del repositorio

```
backend/             Spring Boot 4 / Java 25 / PostGIS / Flyway        → docs/backend/
frontend/src         web consola (Angular 21, Tailwind v4, PrimeNG)
frontend/projects/mobile   app móvil (Ionic 9, Capacitor 8), android/ versionado → DESIGN.md
frontend/tsconfig.json     alias @core/* → src/app/core (compartido web↔móvil)
docs/design/dark-ops       prototipos de pantalla (code.html, assets); referencia, no reglas
odd/                 tareas y auditorías históricas (contexto, no ley)
landing/             tienda estática (fuera del sistema de diseño)
```
