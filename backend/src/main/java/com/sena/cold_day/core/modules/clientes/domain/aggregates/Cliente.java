package com.sena.cold_day.core.modules.clientes.domain.aggregates;

import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteSinDireccionException;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
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
        return nuevoCliente;

    }

    public static Cliente reconstruir(ClienteId clienteId, UsuarioId usuarioId, TipoCliente tipoCliente, DireccionPrincipal direccionPrincipal, boolean activo){

        Cliente cliente = registrar(usuarioId,tipoCliente,direccionPrincipal);
        cliente.id = clienteId;
        cliente.activo = true;
        return cliente;


    }

    public void actualizarDireccion(DireccionPrincipal nuevaDireccion){
        this.direccionPrincipal  = nuevaDireccion;

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
