package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;

public interface SpringDataRequerimientoInsumoRepository
        extends JpaRepository<RequerimientoInsumoJpaEntity, UUID> {

    List<RequerimientoInsumoJpaEntity> findByOtId(UUID otId);

    List<RequerimientoInsumoJpaEntity> findByTecnicoId(UUID tecnicoId);

    List<RequerimientoInsumoJpaEntity> findByEstadoAndExpiraEnLessThanEqual(EstadoRequerimiento estado,
            Instant ahora);

    @Query("SELECT r FROM RequerimientoInsumoJpaEntity r WHERE r.estado = :estado AND r.radioKm IS NOT NULL "
            + "AND r.ventanaExpiraEn <= :ahora AND r.expiraEn > :ahora ORDER BY r.ventanaExpiraEn ASC")
    List<RequerimientoInsumoJpaEntity> buscarEscalables(@Param("estado") EstadoRequerimiento estado,
            @Param("ahora") Instant ahora);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.radioKm = :radio, r.ventanaExpiraEn = :ventana "
            + "WHERE r.id = :id AND r.estado = :abierto")
    int escalarSiAbierto(@Param("id") UUID id, @Param("radio") Double radioKm,
            @Param("ventana") Instant ventanaExpiraEn, @Param("abierto") EstadoRequerimiento abierto);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.etaAvisoEn = :ahora "
            + "WHERE r.id = :id AND r.estado = :asignado AND r.etaAvisoEn IS NULL")
    int marcarEtaAvisado(@Param("id") UUID id, @Param("ahora") Instant ahora,
            @Param("asignado") EstadoRequerimiento asignado);

    @Query(value = "SELECT * FROM requerimiento_insumo WHERE estado = 'ASIGNADO' AND eta_minutos IS NOT NULL "
            + "AND eta_aviso_en IS NULL AND aceptada_en + (eta_minutos * interval '1 minute') <= :ahora "
            + "ORDER BY aceptada_en ASC", nativeQuery = true)
    List<RequerimientoInsumoJpaEntity> buscarEtaVencidos(@Param("ahora") Instant ahora);

    /**
     * Atomic first-accept root gate (design AD6): exactly one concurrent accept
     * can flip the request to {@code ASIGNADO}, and only while its window is open.
     * Returns 1 for the winner, 0 otherwise.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.estado = :destino, r.etaMinutos = :eta, "
            + "r.distanciaKm = :distancia, r.aceptadaEn = :ahora "
            + "WHERE r.id = :id AND r.estado = :origen AND r.expiraEn > :ahora")
    int asignarSiDisponible(@Param("id") UUID id, @Param("ahora") Instant ahora,
            @Param("origen") EstadoRequerimiento origen, @Param("destino") EstadoRequerimiento destino,
            @Param("eta") Integer etaMinutos, @Param("distancia") Double distanciaKm);

    /**
     * Bulk resolution of every open request whose window expired with no winner
     * ({@code SOLICITADO -> SIN_PROVEEDOR}). Returns how many rows were closed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.estado = :destino, r.resueltaEn = :ahora "
            + "WHERE r.estado = :origen AND r.expiraEn <= :ahora")
    int expirarVencidos(@Param("ahora") Instant ahora,
            @Param("origen") EstadoRequerimiento origen, @Param("destino") EstadoRequerimiento destino);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE requerimiento_insumo SET estado = 'SOLICITADO', expira_en = :expira, "
            + "radio_km = :radio, ventana_expira_en = :ventana, eta_minutos = NULL, distancia_km = NULL, "
            + "aceptada_en = NULL, eta_aviso_en = NULL, version = version + 1 "
            + "WHERE id = :id AND tecnico_id = :tecnico AND estado = 'ASIGNADO' "
            + "AND aceptada_en + (eta_minutos * interval '1 minute') <= :ahora", nativeQuery = true)
    int reabrirSiEtaVencido(@Param("id") UUID id, @Param("tecnico") UUID tecnicoId, @Param("ahora") Instant ahora,
            @Param("expira") Instant expiraEn, @Param("radio") double radioKm,
            @Param("ventana") Instant ventanaExpiraEn);

    /** One statement on purpose: the offer check cannot go stale between a read and the write. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE requerimiento_insumo r SET estado = 'DESPACHADO', despachada_en = :ahora, "
            + "version = r.version + 1 WHERE r.id = :id AND r.estado = 'ASIGNADO' AND EXISTS "
            + "(SELECT 1 FROM oferta_insumo o WHERE o.requerimiento_id = r.id AND o.proveedor_id = :proveedor "
            + "AND o.estado = 'ACEPTADA')", nativeQuery = true)
    int despacharSiAsignado(@Param("id") UUID id, @Param("proveedor") UUID proveedorId,
            @Param("ahora") Instant ahora);
}
