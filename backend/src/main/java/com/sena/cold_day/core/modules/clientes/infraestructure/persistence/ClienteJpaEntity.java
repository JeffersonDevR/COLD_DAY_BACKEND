package com.sena.cold_day.core.modules.clientes.infraestructure.persistence;


import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
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
    private long usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false,length = 10)
    private TipoCliente tipo;

    @Column(name = "direccion_principal",length = 500)
    private String direccionPrincipal;

    @Column(nullable = false)
    private boolean activo  = true;

}
