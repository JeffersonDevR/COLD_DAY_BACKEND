package com.sena.cold_day.core.modules.proveedores.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Perfil del proveedor autenticado. El perfil sale del principal, nunca del
 * body: solo se puede leer y completar el propio. El registro ya no pide razon
 * social ni NIT; se completan aqui.
 */
@Service
public class GestionarMiPerfilProveedorUseCase {

    private final ProveedorRepository proveedorRepository;

    public GestionarMiPerfilProveedorUseCase(ProveedorRepository proveedorRepository) {
        this.proveedorRepository = proveedorRepository;
    }

    @Transactional(readOnly = true)
    public ProveedorResponse obtener(UsuarioId usuarioId) {
        return ProveedorResponse.from(proveedorPorUsuario(usuarioId));
    }

    @Transactional
    public ProveedorResponse completarDatos(UsuarioId usuarioId, String razonSocial, String nit) {
        Proveedor proveedor = proveedorPorUsuario(usuarioId);
        proveedor.completarDatosComerciales(razonSocial, nit);
        return ProveedorResponse.from(proveedorRepository.save(proveedor));
    }

    private Proveedor proveedorPorUsuario(UsuarioId usuarioId) {
        return proveedorRepository.findByUsuarioId(usuarioId.valor())
                .orElseThrow(() -> new IllegalArgumentException("Perfil de proveedor no encontrado"));
    }
}
