-- V13 — Issue date on technician documents (design D6, WS4/M7).
--
-- Approval now requires every required document to carry a fecha_expedicion
-- and, when a fecha_vencimiento is set, that expiry must not be in the past.
-- The column is NULLABLE and no date is fabricated: legacy rows stay NULL and
-- remain blocked from approval until re-uploaded (accepted, ~no prod impact).
--
-- Idempotent/defensive: safe to re-run. V1 is an immutable baseline, so the
-- column is added here rather than edited in place.

ALTER TABLE documento_tecnico ADD COLUMN IF NOT EXISTS fecha_expedicion date;
