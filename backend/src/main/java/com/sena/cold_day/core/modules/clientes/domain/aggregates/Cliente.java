package com.sena.cold_day.core.modules.clientes.domain.aggregates;

import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteSinDireccionException;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
public class Cliente {

    private ClienteId id;
    private UsuarioId usuarioId;
    private TipoCliente tipoCliente;
    private DireccionPrincipal direccionPrincipal;
    private boolean activo;



    private Cliente(){}

    public static Cliente registrar(UsuarioId usuarioId, TipoCliente tipoCliente, DireccionPrincipal direccionPrincipal){
        if (usuarioId == null) throw new IllegalArgumentException("Usuario Id requerido");
        if (tipoCliente == null) throw  new IllegalArgumentException("Tipo de cliente requerido");
        Cliente nuevoCliente = new Cliente();
        nuevoCliente.id = ClienteId.nueva();
        nuevoCliente.usuarioId = usuarioId;
        nuevoCliente.tipoCliente = tipoCliente;
        nuevoCliente.direccionPrincipal = direccionPrincipal;
        nuevoCliente.activo = true;
        return nuevoCliente;

    }

    public static Cliente reconstituir(ClienteId clienteId, UsuarioId usuarioId, TipoCliente tipoCliente, DireccionPrincipal direccionPrincipal, boolean activo){

        Cliente cliente = registrar(usuarioId,tipoCliente,direccionPrincipal);
        cliente.id = clienteId;
        cliente.activo = activo;
        return cliente;


    }

    public void actualizarDireccion(DireccionPrincipal nuevaDireccion){
        this.direccionPrincipal  = nuevaDireccion;

    }

    /**
     * Captures a new coordinate while preserving the textual address
     * (RF-F1-06). Range validation lives in {@link Point}.
     */
    public void actualizarUbicacion(Point ubicacion) {
        if (ubicacion == null) {
            throw new IllegalArgumentException("La ubicacion es requerida");
        }
        if (direccionPrincipal == null) {
            throw new ClienteSinDireccionException();
        }
        this.direccionPrincipal = DireccionPrincipal.con(direccionPrincipal.getCalle(),
                direccionPrincipal.getCiudad(), direccionPrincipal.getBarrio(), ubicacion);
    }
    public String direccionTextoCompleto() {
        if (direccionPrincipal == null) throw new ClienteSinDireccionException();
        return direccionPrincipal.textoCompleto();
    }

    public ClienteId getId() {
        return id;
    }

    public UsuarioId getUsuarioId() {
        return usuarioId;
    }

    public TipoCliente getTipoCliente() {
        return tipoCliente;
    }

    public DireccionPrincipal getDireccionPrincipal() {
        return direccionPrincipal;
    }

    public boolean isActivo() {
        return activo;
    }
}
