package com.sena.cold_day.core.modules.usuarios.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;

/** Puerto de persistencia de tokens push (adaptador JPA). */
public interface DispositivoPushRepository {

    DispositivoPush save(DispositivoPush dispositivo);

    /** Alta o reasignacion atomica (upsert por token). */
    void registrar(Long usuarioId, String token, String plataforma);

    Optional<DispositivoPush> buscarPorToken(String token);

    /** Tokens de un usuario; acotado por el limite de dispositivos (BE-P1). */
    List<DispositivoPush> listarPorUsuario(Long usuarioId, int limite);

    /** Borra el token solo si pertenece al usuario; devuelve las filas afectadas. */
    int eliminar(Long usuarioId, String token);
}
