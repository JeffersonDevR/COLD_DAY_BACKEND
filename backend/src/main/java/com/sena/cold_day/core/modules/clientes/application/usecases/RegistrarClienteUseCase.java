package com.sena.cold_day.core.modules.clientes.application.usecases;


import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.application.mappers.ClienteMapper;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.infraestructure.repository.ClienteRespository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class RegistrarClienteUseCase {
    private final ClienteRespository clienteRespository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteMapper clienteMapper;

    public RegistrarClienteUseCase(ClienteRespository clienteRespository, UsuarioRepository usuarioRepository, ClienteMapper clienteMapper) {
        this.clienteRespository = clienteRespository;
        this.usuarioRepository = usuarioRepository;
        this.clienteMapper = clienteMapper;
    }

    @Transactional
    public ClienteResponse registrar(ClienteRequest request , UsuarioId usuarioId){

        Usuario usuario = usuarioRepository.buscarPorId(new UsuarioId(usuarioId.valor()))
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));


        Cliente cliente = clienteRespository.save(Cliente.registrar(
                usuario.getUsuarioId(), request.tipoCliente(), DireccionPrincipal.con(request.calle(),request.ciudad(),request.barrio(),request.ubicacion())
        ));

        return clienteMapper.toResponse(usuario, cliente);
    }
}
