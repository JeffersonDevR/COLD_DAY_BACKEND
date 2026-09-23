package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorRequest;
import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * Admin-only supplier provisioning. Mirrors {@code RegistrarTecnicoUseCase}: the
 * Usuario (identity) is created first with {@code Rol.PROVEEDOR} applied at
 * creation, then the Proveedor (business identity) is linked to it, all inside a
 * single transaction so no half-created supplier account can persist.
 *
 * <p>The administrator supplies the initial password (never generated and never
 * echoed back); a duplicate {@code correo} fails with 409 through the module's
 * controller advice.
 */
@Service
public class RegistrarProveedorUseCase {

    private final ProveedorRepository proveedorRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoderPort passwordEncoder;

    public RegistrarProveedorUseCase(ProveedorRepository proveedorRepository, UsuarioRepository usuarioRepository,
            PasswordEncoderPort passwordEncoder) {
        this.proveedorRepository = proveedorRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public ProveedorResponse registrar(ProveedorRequest request) {
        if (usuarioRepository.existeCorreo(request.correo())) {
            throw new CorreoDuplicadoException(request.correo());
        }

        Usuario usuario = usuarioRepository.save(Usuario.registrar(request.nombre(), request.correo(),
                request.password(), request.telefono(), null, Rol.PROVEEDOR, request.aceptaHabeasData(),
                passwordEncoder));

        Proveedor proveedor = proveedorRepository.save(Proveedor.crear(usuario.getId(), request.razonSocial(),
                request.nit(), request.telefono(), null, null, Set.of()));

        return ProveedorResponse.from(proveedor);
    }
}
