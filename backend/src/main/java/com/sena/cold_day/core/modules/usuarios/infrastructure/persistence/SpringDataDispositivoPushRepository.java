package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpringDataDispositivoPushRepository extends JpaRepository<DispositivoPushJpaEntity, Long> {

    Optional<DispositivoPushJpaEntity> findByToken(String token);

    List<DispositivoPushJpaEntity> findByUsuarioIdOrderByActualizadoEnDesc(Long usuarioId, Pageable pageable);

    @Modifying
    @Query("delete from DispositivoPushJpaEntity d where d.usuarioId = :usuarioId and d.token = :token")
    int eliminar(@Param("usuarioId") Long usuarioId, @Param("token") String token);
}
