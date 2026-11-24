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

    /** Alta/reasignacion atomica: dos registros concurrentes del mismo token no chocan con la unique. */
    @Modifying
    @Query(value = """
            insert into dispositivo_push (usuario_id, token, plataforma, creado_en, actualizado_en)
            values (:usuarioId, :token, :plataforma, now(), now())
            on conflict (token) do update
            set usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, actualizado_en = now()
            """, nativeQuery = true)
    int upsert(@Param("usuarioId") Long usuarioId, @Param("token") String token,
            @Param("plataforma") String plataforma);

    @Modifying
    @Query("delete from DispositivoPushJpaEntity d where d.usuarioId = :usuarioId and d.token = :token")
    int eliminar(@Param("usuarioId") Long usuarioId, @Param("token") String token);
}
