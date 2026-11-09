package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.RolesDePerfilPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * CU-02: login. Orchestrates credential verification + token issuing.
 *
 * <p>Dos defensas viven aca y no en el filtro de rate limit, porque el filtro
 * solo ve IP + ruta y no debe leer el cuerpo (consumirlo rompe el binding):
 * <ul>
 * <li><b>Senuelo de tiempo</b>: un correo inexistente cuesta lo mismo que una
 * contrasena incorrecta (bcrypt completo), para no delatar la existencia de la
 * cuenta por latencia.</li>
 * <li><b>Bloqueo por cuenta</b>: el cupo por IP se esquiva con proxies; contar
 * fallos por correo cierra la fuerza bruta distribuida. Se responde 401 igual
 * que con una clave mala (no 429) para no confirmar que la cuenta existe.</li>
 * </ul>
 */
@Service
public class AutenticarUsuarioUseCase {

    /** Fallos por cuenta dentro de la ventana antes de bloquearla. */
    private static final int MAX_FALLOS_POR_CUENTA = 10;

    /** Ventana de bloqueo por cuenta. Tambien es el TTL de la entrada. */
    private static final Duration VENTANA_BLOQUEO = Duration.ofMinutes(15);

    /** Tope de claves: la memoria no crece sin limite con correos inventados. */
    private static final int MAX_CLAVES = 10_000;

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoderPort passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final RolesDePerfilPort rolesDePerfil;

    /**
     * Hash de costo real que se compara cuando el correo NO existe, para que el
     * rechazo cueste lo mismo que un login con contrasena incorrecta. Sin esto,
     * un correo inexistente respondia de inmediato y uno existente tardaba un
     * bcrypt (coste 12, ~200-400 ms): enumeracion de cuentas por tiempo.
     */
    private final String hashSenuelo;

    private final Cache<String, Integer> fallosPorCuenta = Caffeine.newBuilder()
            .maximumSize(MAX_CLAVES)
            .expireAfterWrite(VENTANA_BLOQUEO)
            .build();

    public AutenticarUsuarioUseCase(UsuarioRepository usuarioRepository, PasswordEncoderPort passwordEncoder,
            TokenIssuer tokenIssuer, RolesDePerfilPort rolesDePerfil) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
        this.rolesDePerfil = rolesDePerfil;
        this.hashSenuelo = passwordEncoder.encode("senuelo-" + java.util.UUID.randomUUID());
    }

    public TokenResponse autenticar(String correo, String passwordPlano) {
        String clave = correo == null ? "" : correo.trim().toLowerCase(Locale.ROOT);

        if (cuentaBloqueada(clave)) {
            // Se mantiene el coste criptografico y la excepcion uniforme.
            passwordEncoder.matches(passwordPlano, hashSenuelo);
            throw new CredencialesInvalidasException();
        }

        var encontrado = usuarioRepository.buscarPorCorreo(correo);
        if (encontrado.isEmpty()) {
            // Mismo trabajo criptografico que la rama con usuario, misma excepcion.
            passwordEncoder.matches(passwordPlano, hashSenuelo);
            registrarFallo(clave);
            throw new CredencialesInvalidasException(); // no reveal "correo no existe" vs "clave mala"
        }
        Usuario usuario = encontrado.get();

        try {
            usuario.verificarCredenciales(passwordPlano, passwordEncoder);

            // Una cuenta desactivada no autentica. El flujo de recuperacion ya lo
            // respeta (RecuperarContrasenaUseCase filtra isActivo); el login no lo
            // hacia, asi que una baja de usuario dejaba sus credenciales vivas.
            // Se lanza la misma excepcion que con una clave mala para no revelar el
            // estado de la cuenta.
            if (!usuario.isActivo()) {
                throw new CredencialesInvalidasException();
            }
        } catch (RuntimeException rechazo) {
            registrarFallo(clave);
            throw rechazo;
        }

        fallosPorCuenta.invalidate(clave);

        // Option C: capabilities are derived server-side from persisted profile
        // rows; nothing from the request body can widen them (M3/M5).
        Set<Rol> roles = rolesDePerfil.resolver(usuario.getUsuarioId(), usuario.getRol());
        var token = tokenIssuer.emitir(usuario.getUsuarioId(), usuario.getNombre(), roles,
                usuario.getRol(), usuario.getTokenVersion());
        return new TokenResponse(token.valor(), token.expiracion(), usuario.getRol().name(), List.copyOf(roles));
    }

    private boolean cuentaBloqueada(String clave) {
        Integer fallos = fallosPorCuenta.getIfPresent(clave);
        return fallos != null && fallos >= MAX_FALLOS_POR_CUENTA;
    }

    private void registrarFallo(String clave) {
        if (!clave.isEmpty()) {
            fallosPorCuenta.asMap().merge(clave, 1, Integer::sum);
        }
    }
}
