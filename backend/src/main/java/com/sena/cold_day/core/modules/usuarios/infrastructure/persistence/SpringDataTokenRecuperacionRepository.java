package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpringDataTokenRecuperacionRepository extends JpaRepository<TokenRecuperacionJpaEntity, Long> {

    Optional<TokenRecuperacionJpaEntity> findByTokenHash(String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TokenRecuperacionJpaEntity t set t.usado = true "
            + "where t.usuarioId = :usuarioId and t.usado = false")
    int invalidarPendientesDe(@Param("usuarioId") Long usuarioId);
}
