package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.CuentaInternaInvitada;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.PermisosPorRol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Cuentas del panel que gestiona el administrador. */
@Service
public class GestionarCuentasInternasUseCase {

    /** La misma vigencia que la recuperación de contraseña. */
    private static final Duration VIGENCIA_INVITACION = Duration.ofMinutes(30);

    private final UsuarioRepository usuarios;
    private final TokenRecuperacionRepository tokens;
    private final TokenGeneratorPort tokenGenerator;
    private final PasswordEncoderPort passwordEncoder;
    private final ApplicationEventPublisher events;

    public GestionarCuentasInternasUseCase(UsuarioRepository usuarios, TokenRecuperacionRepository tokens,
            TokenGeneratorPort tokenGenerator, PasswordEncoderPort passwordEncoder,
            ApplicationEventPublisher events) {
        this.usuarios = usuarios;
        this.tokens = tokens;
        this.tokenGenerator = tokenGenerator;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<Usuario> listar() {
        return usuarios.listarPorRoles(PermisosPorRol.rolesGestionables());
    }

    @Transactional
    public Usuario crear(String nombre, String correo, Rol rol) {
        // La contraseña inicial es aleatoria y se descarta: nadie la conoce.
        Usuario nueva = Usuario.crearCuentaInterna(nombre, correo, rol, tokenGenerator.generar(), passwordEncoder);
        if (usuarios.existeCorreo(correo)) {
            throw new CorreoDuplicadoException(correo);
        }
        Usuario guardada = usuarios.save(nueva);
        Instant ahora = Instant.now();
        String tokenPlano = tokenGenerator.generar();
        tokens.save(TokenRecuperacion.emitir(guardada.getUsuarioId(), tokenGenerator.hash(tokenPlano),
                ahora, ahora.plus(VIGENCIA_INVITACION)));
        events.publishEvent(new CuentaInternaInvitada(guardada.getId(), guardada.getCorreo(), tokenPlano));
        return guardada;
    }

    @Transactional
    public void cambiarEstado(UsuarioId id, boolean activa) {
        Usuario cuenta = usuarios.buscarPorId(id)
                .filter(u -> PermisosPorRol.rolesGestionables().contains(u.getRol()))
                .orElseThrow(() -> new UsuarioNoEncontradoException(id.valor()));
        if (activa) {
            cuenta.reactivar();
        } else {
            cuenta.desactivar();
            // Las sesiones abiertas dejan de servir de inmediato.
            cuenta.incrementarTokenVersion();
            // Y un enlace de invitación o recuperación pendiente deja de valer, también si se reactiva.
            tokens.invalidarTodosDe(id);
        }
        usuarios.save(cuenta);
    }
}
