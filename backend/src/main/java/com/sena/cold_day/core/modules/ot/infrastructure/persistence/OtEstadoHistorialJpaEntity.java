package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.Immutable;

import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Append-only JPA mapping of {@code ot_estado_historial} (RNF-09, design D3).
 * {@code @Immutable} makes Hibernate ignore updates and deletes on this entity;
 * the domain port exposes no such operations either.
 */
@Entity
@Table(name = "ot_estado_historial")
@Immutable
@Getter
@Setter
@NoArgsConstructor
public class OtEstadoHistorialJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ot_id", nullable = false)
    private UUID otId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_origen", length = 30)
    private EstadoOt estadoOrigen;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_destino", length = 30, nullable = false)
    private EstadoOt estadoDestino;

    /** Reserved for principal-level audit; populated by later slices. */
    @Column(name = "actor_usuario_id")
    private Long actorUsuarioId;

    /** Reserved for principal-level audit; populated by later slices. */
    @Column(name = "actor_rol", length = 20)
    private String actorRol;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor", length = 20)
    private ActorOt actor;

    @Column(name = "ocurrido_en", nullable = false)
    private Instant ocurridoEn;

    @Column(name = "motivo", length = 500)
    private String motivo;

    public static OtEstadoHistorialJpaEntity fromDomain(OtEstadoHistorial source) {
        OtEstadoHistorialJpaEntity target = new OtEstadoHistorialJpaEntity();
        target.id = source.getId();
        CambioEstado cambio = source.getCambio();
        target.otId = source.getOtId().valor();
        target.estadoOrigen = cambio.origen();
        target.estadoDestino = cambio.destino();
        target.actor = cambio.actor();
        target.ocurridoEn = cambio.ocurridoEn();
        target.motivo = cambio.motivo();
        target.actorUsuarioId = source.getActorUsuarioId();
        target.actorRol = source.getActorRol();
        return target;
    }

    public OtEstadoHistorial toDomain() {
        CambioEstado cambio = new CambioEstado(estadoOrigen, estadoDestino, actor, ocurridoEn, motivo);
        return OtEstadoHistorial.reconstituir(id, new OtId(otId), cambio, actorUsuarioId, actorRol);
    }
}
