# Feature: Resend email provider + technician OT roles

## Objective
Implement Resend as an email provider for password recovery, and allow a technician to create work orders while preventing them from accessing the orders they created as a client.

## Scope (authorized)
- Add Resend HTTP delivery adapter following existing mail port pattern.
- Allow `TECNICO` to create OTs (`OtController.crear`).
- Deny a technician access to OTs created under their own client profile.
- Preserve existing authorization behavior for all other participants.

## Changes
- backend/src/main/java/.../mail/ResendNotificadorRecuperacion.java (new)
- application.properties/mail provider defaults
- backend/.env local provider selection
- OtController PreAuthorize adjustment
- AutorizacionPropietario.esParticipanteOAdmin technician self-access guard
- AceptarOfertaUseCase test constructor alignment (null self)

## Verification
- `gradlew compileJava` SUCCESS
- `gradlew testClasses` SUCCESS
- Mail provider tests SUCCESS
- OT integration tests not run (require Docker/Testcontainers); compile pass only.

## Next steps
- Run OT integration suites against Docker.
- Configure deployment env with `MAIL_PROVIDER=resend` and `RESEND_API`.
- Consider auto-creating client profile for technicians requesting services.