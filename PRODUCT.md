# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administrador / Contable** — the internal control tower. They arrive mid-shift, with several work orders in flight at once, and need to answer "what is stuck and who unblocks it" without hunting. Their job: monitor orders, validate technicians, reconcile deposits, mediate disputes.
- **Técnico** — a certified independent technician in Cúcuta. Reaches the product on a phone, often standing on a roof or inside a fridge unit, sometimes with gloves on. Their job: catch work, execute it, get paid.
- **Cliente** — a household or business in Cúcuta or the metro area. Their job: get the right technician, approve a price they trust, and know the service is warranted.
- **Proveedor** — an auxiliary supplier. Narrow job: receive and fulfil part dispatches.

One person can hold both CLIENTE and TECNICO profiles; the product supports acquiring a second profile on the same identity.

## Product Purpose

COLD DAY S.A.S. intermediates technical home services — refrigeration, air conditioning, electrical work, and household appliances — in Cúcuta, Norte de Santander, Colombia. The platform turns a phone call that used to be informal into a traced work order: a request, a dispatched technician, a diagnosed budget, an approved execution, a signed delivery record, a payment, and a warranty.

Success means the customer never has to ask "what happened to my service?", the technician is never left guessing whether they will be paid, and the company can prove every step after the fact.

## Positioning

The mechanism a generic marketplace listing cannot copy: **the work order is the product**. Every service carries a durable record — geolocated request, technician assignment, supplier/parts breakdown, budget split between labor, parts, and a platform commission, a signed acta with a verification code, a settlement trail, and a 90-day formal warranty. Disputes are mediated against that record instead of argued from memory.

## Operating Context

- Geography is real and constraining: Cúcuta plus Los Patios, Villa del Rosario, and San Cayetano. Distances are short but traffic and unmapped barrios are not; the product leans on geolocation and map previews rather than on confidence in addresses.
- Technicians work from a phone, in the field, one-handed. The desktop web app is where back-office, accounting, and the heavier client flows happen.
- Money moves in two directions: customers pay on delivery of the acta, and technicians are settled through consignments that accounting reconciles.
- Commercial vocabulary in use: OT (orden de trabajo), consignación, liquidación, acta, dictamen, comisión de plataforma, proveedor auxiliar, garantía.
- The audience reads Spanish (Colombia). The product speaks in tuteo, not in usted and not in voseo.

## Capabilities and Constraints

**Confirmed surfaces in this repository**

| Surface | Path | Stack |
|---|---|---|
| Web app (dashboard) | `frontend/src` | Angular 21, Tailwind CSS v4, PrimeNG 21 (Aura preset), PrimeIcons, Google Maps |
| Mobile app | `frontend/projects/mobile` | Ionic 9 + Angular 21, Capacitor 8 (Android) |
| Marketing landing | `landing` | Static HTML/CSS |
| API | `backend` | Spring Boot 4.1.1, Java 25, JPA, Security, SMTP, springdoc |

**Role model** — `CLIENTE`, `TECNICO`, `ADMINISTRADOR`, `CONTABLE`, `PROVEEDOR`.

**Order lifecycle** — `SOLICITADA` → `BUSCANDO_TECNICO` → `ASIGNADA` → `EN_CAMINO` → `EN_DIAGNOSTICO` → `EN_REPARACION` → `FINALIZADA`, with `CANCELADA`, `DISPUTADA`, and `SIN_TECNICOS_DISPONIBLES` as exits.

**Constraints that bind future work**
- WCAG AA contrast is non-negotiable; a mid-grey that reads fine in isolation has already failed here before (`#64748b` on the dark canvas sits below 4.5:1 and is prohibited).
- Motion must honour `prefers-reduced-motion`; the technician flow runs on low-end Android hardware.
- Locale is `es-CO` for dates and numbers; currency amounts are Colombian pesos.
- Map keys and map configuration arrive from the backend at startup and must degrade when the backend is unreachable.

**Deliberately undecided** — there is no confirmed public pricing schedule, no confirmed service-level target for technician arrival, and no confirmed customer-facing refund policy beyond the 90-day warranty claim. Future work must not invent any of these.

## Brand Commitments

- Legal name **COLD DAY S.A.S.**; the product name in the interface is **COLD DAY**.
- The company's visual identity is already expressed in two places: the light sky-blue world of the landing page and the dark "Dark Ops" world of the mobile app. The dark world is the product's operational identity; the light world is the storefront.
- Voice: direct, warm, operational Spanish (Colombia), tuteo. It explains what happened and what to do next. It does not celebrate, and it does not use generic encouragement.
- The iconography set is PrimeIcons on web/mobile and Ionicons inside the Ionic mobile shell.

## Evidence on Hand

- Working product code for all four surfaces, with a real order lifecycle, role guards, and a settlement model.
- A written design reference for the transaction flow: `docs/design/dark-ops/flujo-solicitud/` (tokens, contrast rules, CTA states, ergonomics decisions).
- Mobile theme tokens, in production: `frontend/projects/mobile/src/styles.css`.

**Absences that future work must not fabricate** — no customer testimonials, no press coverage, no partner logos, no audited service counts, no star rating that is not computed from real ratings, and no performance benchmarks.

## Product Principles

1. **The record is the truth.** Any screen that shows an order state must be able to show how it got there. History is not decoration.
2. **Honest states beat optimistic ones.** "Buscando técnico" means nobody has accepted yet, and the interface says exactly that. No fake progress, no invented ETA, no placeholder metric.
3. **The technician is a user, not a resource.** Roughly half the design surface exists so a technician can work one-handed, in the sun, and still get paid correctly.
4. **Money is never ambiguous.** Commission, parts, labor, and settlement are always broken out; an amount on screen can always be traced to its components.
5. **One identity, several roles.** A person is not a "client account" or a "technician account"; they are one person who may hold both.

## Accessibility & Inclusion

- Target WCAG 2.1 AA for contrast, focus visibility, and target size.
- Field use: touch targets on the mobile surface are at least 44×44 px, and the primary mobile action is 48 px tall.
- The web app must remain fully operable by keyboard; icon-only controls require an accessible name.
