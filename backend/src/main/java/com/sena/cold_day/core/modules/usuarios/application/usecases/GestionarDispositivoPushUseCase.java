package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Alta (idempotente) y baja del token push del principal autenticado. El
 * usuario sale siempre del principal: un token jamas se registra ni se borra
 * a nombre de otra cuenta, y registrar un token ya conocido lo reasigna.
 */
@Service
public class GestionarDispositivoPushUseCase {

    private final DispositivoPushRepository dispositivos;

    public GestionarDispositivoPushUseCase(DispositivoPushRepository dispositivos) {
        this.dispositivos = dispositivos;
    }

    @Transactional
    public void registrar(UsuarioId usuarioId, String token, String plataforma) {
        dispositivos.registrar(usuarioId.valor(), token, plataforma);
    }

    /** Idempotente: borrar un token que ya no existe (o ajeno) no es un error. */
    @Transactional
    public void darDeBaja(UsuarioId usuarioId, String token) {
        dispositivos.eliminar(usuarioId.valor(), token);
    }
}
