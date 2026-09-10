package com.sena.cold_day.core.modules.clientes.application.mappers;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.shared.domain.Point;

@Component
public class ClienteMapper {
    public void apply(ClienteRequest request, Cliente cliente){
        DireccionPrincipal direccionPrincipal = DireccionPrincipal.sinUbicacion(
                request.calle(),request.ciudad(),request.barrio()
        );
        if (request.ubicacion() != null)
        {
            direccionPrincipal = DireccionPrincipal.con(
                    request.calle(),request.ciudad(),request.barrio(),request.ubicacion()
            );
        }
        cliente.actualizarDireccion(direccionPrincipal);


    }

    public ClienteResponse toResponse(Usuario usuario, Cliente cliente){
        return new ClienteResponse(
                cliente.getId(),
                usuario.getUsuarioId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                usuario.getTelefono(),
                usuario.getFotoUrl(),
                cliente.getTipoCliente(),
                cliente.getDireccionPrincipal(),
                cliente.isActivo()
        );

    }


}
