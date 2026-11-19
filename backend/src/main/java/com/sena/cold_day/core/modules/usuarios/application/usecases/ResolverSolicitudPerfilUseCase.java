package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.time.Instant;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.usecases.RegistrarClienteUseCase;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoPerfilRequest;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.RegistrarPerfilTecnicoUseCase;
import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilNoEncontradaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilYaResueltaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.SolicitudPerfilRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Resolucion admin de una solicitud de perfil. Al aprobar, se adopta el perfil
 * con los casos de uso existentes y {@code desdeAdmin=true}: la puerta T4.3 se
 * saltea SOLO en este camino, nunca en el self-service. Al rechazar no se crea
 * perfil, no se toca {@code usuario.rol} y no se rota tokenVersion.
 *
 * <p>La solicitud no transporta datos del perfil (solo destino y motivacion),
 * asi que la adopcion siembra el perfil con datos minimos y validos: el usuario
 * completa los detalles luego por los endpoints {@code /me/perfil} ya existentes.
 */
@Service
public class ResolverSolicitudPerfilUseCase {

    private static final String DATOS_PENDIENTES = "Por completar";

    private final SolicitudPerfilRepository solicitudes;
    private final UsuarioRepository usuarios;
    private final RegistrarClienteUseCase registrarCliente;
    private final RegistrarPerfilTecnicoUseCase registrarTecnico;

    public ResolverSolicitudPerfilUseCase(SolicitudPerfilRepository solicitudes, UsuarioRepository usuarios,
            RegistrarClienteUseCase registrarCliente, RegistrarPerfilTecnicoUseCase registrarTecnico) {
        this.solicitudes = solicitudes;
        this.usuarios = usuarios;
        this.registrarCliente = registrarCliente;
        this.registrarTecnico = registrarTecnico;
    }

    @Transactional
    public SolicitudPerfilResponse resolver(Long id, boolean aprobar, String motivoRechazo) {
        SolicitudPerfil solicitud = solicitudes.buscarPorId(id)
                .orElseThrow(() -> new SolicitudPerfilNoEncontradaException(id));
        if (solicitud.estaResuelta()) {
            throw new SolicitudPerfilYaResueltaException(id);
        }

        if (aprobar) {
            adoptarPerfil(solicitud);
            solicitud.aprobar(Instant.now());
        } else {
            solicitud.rechazar(motivoRechazo, Instant.now());
        }
        return SolicitudPerfilResponse.from(solicitudes.save(solicitud));
    }

    private void adoptarPerfil(SolicitudPerfil solicitud) {
        UsuarioId usuarioId = new UsuarioId(solicitud.getUsuarioId());
        Usuario usuario = usuarios.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

        if (solicitud.getPerfilDeseado() == Rol.CLIENTE) {
            registrarCliente.registrar(
                    new ClienteRequest(TipoCliente.B2C, DATOS_PENDIENTES, DATOS_PENDIENTES, null, null),
                    usuarioId, true);
        } else {
            // El numero de identificacion se siembra con el correo: es unico y
            // no nulo. El tecnico lo completa mas adelante desde su perfil.
            registrarTecnico.registrar(usuarioId,
                    new TecnicoPerfilRequest(usuario.getCorreo(), Set.of(), Set.of()), true);
        }
    }
}
