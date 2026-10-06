package com.sena.cold_day.core.shared.infrastructure.config;

import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Enables Spring Data JPA auditing and supplies the auditor for
 * {@code clientes}, {@code tecnico}, {@code ot} and {@code proveedor}.
 *
 * <p>Declared in a dedicated {@code @Configuration} — mirroring the existing
 * {@link ClockConfig} precedent — and deliberately NOT on
 * {@code ColdDayApplication}. {@code @DataJpaTest} slices do not load
 * {@code @SpringBootApplication}, so auditing wired only on the main class would
 * be missing inside a slice and every audited field would silently stay null.
 * A dedicated class can be pulled in explicitly with
 * {@code @Import(AuditoriaConfig.class)}.
 *
 * <p><strong>Single seam.</strong> {@link AuthenticatedUser} is the principal
 * installed by both {@code JwtAuthenticationFilter} in production and
 * {@code DevAuthBypassFilter} in dev, so this one method resolves the auditor
 * identically on both paths. There is no second place to keep in sync.
 *
 * <p><strong>The {@code "system"} sentinel is a behavioral contract, not an
 * implementation detail.</strong> Five {@code @Scheduled} schedulers,
 * {@code DevDataSeeder} and every test insert write to these tables with an empty
 * {@code SecurityContextHolder}. An {@code AuditorAware} that returned
 * {@code null} or threw would break background jobs and dev startup, so
 * {@code "system"} is the final fallback. The accepted cost is that scheduler,
 * seeder and test origins are indistinguishable in the audit trail; giving them
 * separate sentinels is a follow-up migration.
 *
 * <p><strong>Audit time is not business time.</strong> Audit instants come from
 * Spring's {@code DateTimeProvider} (non-deterministic current time by default),
 * which is deliberately NOT the {@code Clock} bean from {@link ClockConfig}.
 * {@code Clock} governs business time only, so
 * {@code ot.creada_en}, {@code proveedor.creado_en} and
 * {@code tecnico.ubicacion_actualizada_en} keep their own domain sources. A test
 * that needs a deterministic audit instant must supply a test-scoped
 * {@code DateTimeProvider}; it must never try to route auditing through
 * {@code Clock}.
 *
 * <p><strong>Accepted limitation — bulk JPQL bypass.</strong> Writes issued by a
 * bulk {@code @Modifying @Query} update go straight to the database and skip the
 * entity lifecycle, so they do NOT refresh {@code updated_at} or
 * {@code last_modified_by}. Concretely, the {@code oferta_ot} writes in
 * {@code EscalarRadioUseCase} and {@code LimpiarOrdenesHuerfanasUseCase}.
 * {@code oferta_ot} is not one of the four tables audited here, and fixing this
 * would require refactoring existing write paths, which this change explicitly
 * excludes. Accepted and out of scope — do not mistake it for a bug.
 *
 * <p>Also accepted: no backfill, so pre-existing rows keep {@code NULL} audit
 * metadata and any future query must handle {@code updated_at IS NULL}; and the
 * four-field audit block is deliberately duplicated across the four entities
 * instead of living in a shared {@code @MappedSuperclass}, which may drift if a
 * future change updates three entities and forgets the fourth.
 */
@Configuration
@EnableJpaAuditing
public class AuditoriaConfig {

    /**
     * Auditor value stored when a write happens with no authenticated principal.
     * Must stay in sync with the {@code COMMENT ON COLUMN} text in
     * {@code V10__auditoria_clientes_tecnico_ot_proveedor.sql}.
     */
    public static final String AUDITOR_SYSTEM = "system";

    @Bean
    public AuditorAware<String> auditorAware() {
        // AuditorAware#getCurrentAuditor returns Optional<T> in Spring Data 3+.
        // resolveAuditor never returns null, so the Optional is always present:
        // an empty Optional would leave @CreatedBy/@LastModifiedBy null, which
        // is exactly the contract this class exists to avoid.
        return () -> Optional.of(resolveAuditor());
    }

    /**
     * Resolves the current auditor. Never returns {@code null} and never throws:
     * {@link #AUDITOR_SYSTEM} is the terminal fallback for an absent
     * authentication, a null principal, or any principal that is not an
     * {@link AuthenticatedUser} (the {@code "anonymousUser"} string, for
     * instance).
     */
    private String resolveAuditor() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null) {
                return AUDITOR_SYSTEM;
            }
            return Optional.ofNullable(authentication.getPrincipal())
                    .filter(AuthenticatedUser.class::isInstance)
                    .map(AuthenticatedUser.class::cast)
                    .map(user -> user.usuarioId().valor().toString())
                    .orElse(AUDITOR_SYSTEM);
        } catch (RuntimeException ex) {
            // Auditing must never be the reason a background job or a public
            // registration fails; a wrong auditor is preferable to no write.
            // ex es intencionalmente no usado: el fallback es siempre "system"
            // independientemente del tipo de excepción.
            return AUDITOR_SYSTEM;
        }
    }
}
