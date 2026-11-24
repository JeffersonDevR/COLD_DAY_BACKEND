package com.sena.cold_day.core.modules.clientes.application.usecases;


import com.sena.cold_day.core.modules.clientes.application.dto.ClienteOnboardingRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.application.mappers.ClienteMapper;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteDuplicadoException;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.UsuarioRegistrado;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.PerfilNoAdquiribleException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordina el agregado Usuario (identidad) y el Cliente (perfil) en una sola
 * transacción, siguiendo el mismo patrón que {@code RegistrarTecnicoUseCase}.
 */
@Service
public class RegistrarClienteUseCase {
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteMapper clienteMapper;
    private final PasswordEncoderPort passwordEncoder;
    private final ApplicationEventPublisher events;

    public RegistrarClienteUseCase(ClienteRepository clienteRepository, UsuarioRepository usuarioRepository,
            ClienteMapper clienteMapper, PasswordEncoderPort passwordEncoder, ApplicationEventPublisher events) {
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
        this.clienteMapper = clienteMapper;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    /**
     * Alta pública: crea el Usuario (rol CLIENTE) y su perfil de Cliente de forma
     * atómica. Si el correo ya existe, no se crea nada (rollback).
     */
    @Transactional
    public ClienteResponse registrarNuevo(ClienteOnboardingRequest request) {
        if (usuarioRepository.existeCorreo(request.correo())) {
            throw new CorreoDuplicadoException(request.correo());
        }

        Usuario usuario = usuarioRepository.save(Usuario.registrar(
                request.nombre(), request.correo(), request.password(), request.telefono(),
                request.fotoUrl(), Rol.CLIENTE, request.aceptaHabeasData(), passwordEncoder));

        boolean sinDireccion = (request.calle() == null || request.calle().isBlank())
                && (request.ciudad() == null || request.ciudad().isBlank());
        Cliente cliente = clienteRepository.save(Cliente.registrar(
                usuario.getUsuarioId(), request.tipoCliente() == null ? TipoCliente.B2C : request.tipoCliente(),
                sinDireccion ? null
                        : DireccionPrincipal.con(request.calle(), request.ciudad(), request.barrio(), request.ubicacion())));

        events.publishEvent(new UsuarioRegistrado(usuario.getId(), Rol.CLIENTE));
        return clienteMapper.toResponse(usuario, cliente);
    }

    /**
     * Crea solo el perfil para un usuario ya existente (reparación/backfill).
     * T4.3: la adopcion self-service solo la puede hacer quien se registro como
     * tecnico; los demas piden el cambio al administrador.
     */
    @Transactional
    public ClienteResponse registrar(ClienteRequest request, UsuarioId usuarioId) {
        return registrar(request, usuarioId, false);
    }

    /** {@code desdeAdmin=true} bypasses only the T4.3 initial-role gate. */
    @Transactional
    public ClienteResponse registrar(ClienteRequest request, UsuarioId usuarioId, boolean desdeAdmin) {

        Usuario usuario = usuarioRepository.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

        if (!desdeAdmin && usuario.getRol() != Rol.TECNICO) {
            throw new PerfilNoAdquiribleException();
        }

        if (clienteRepository.findByUsuarioId(usuarioId).isPresent()) {
            throw new ClienteDuplicadoException(usuarioId);
        }

        Cliente cliente = clienteRepository.save(Cliente.registrar(
                usuario.getUsuarioId(), request.tipoCliente(), DireccionPrincipal.con(request.calle(), request.ciudad(), request.barrio(), request.ubicacion())
        ));

        // Second-profile acquisition: bump the token version, which revokes the
        // token in flight (design D3). The controller returns the replacement
        // carrying the new CLIENTE capability, so no re-login is needed.
        usuario.incrementarTokenVersion();
        usuarioRepository.save(usuario);

        return clienteMapper.toResponse(usuario, cliente);
    }
}
