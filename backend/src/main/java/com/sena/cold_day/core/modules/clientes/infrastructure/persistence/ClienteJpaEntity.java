package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;


import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "clientes")
@Getter
@Setter
@NoArgsConstructor
public class ClienteJpaEntity {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false, unique = true)
    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoCliente tipo;

    /**
     * The textual address components encoded losslessly by
     * {@link DireccionPrincipalCodec}. The optional {@link Point} location is
     * persisted separately in {@code latitud}/{@code longitud}.
     */
    @Column(name = "direccion_principal", length = 500)
    private String direccionPrincipal;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Column(nullable = false)
    private boolean activo = true;

    public static ClienteJpaEntity fromDomain(Cliente source) {
        ClienteJpaEntity target = new ClienteJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.usuarioId = source.getUsuarioId() == null ? null : source.getUsuarioId().valor();
        target.tipo = source.getTipoCliente();
        DireccionPrincipal direccion = source.getDireccionPrincipal();
        target.direccionPrincipal = DireccionPrincipalCodec.encode(direccion);
        Point ubicacion = direccion == null ? null : direccion.getUbicacion();
        target.latitud = ubicacion == null ? null : ubicacion.latitud();
        target.longitud = ubicacion == null ? null : ubicacion.longitud();
        target.activo = source.isActivo();
        return target;
    }

    public Cliente toDomain() {
        return Cliente.reconstituir(new ClienteId(id), new UsuarioId(usuarioId), tipo,
                DireccionPrincipalCodec.decode(direccionPrincipal, latitud, longitud), activo);
    }
}
