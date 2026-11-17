package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilResponse;
import com.sena.cold_day.core.modules.usuarios.domain.repository.SolicitudPerfilRepository;

/** Bandeja admin de solicitudes: siempre limitada, nunca un listado completo (BE-P1). */
@Service
public class ListarSolicitudesPerfilUseCase {

    private static final int LIMITE_MAXIMO = 50;

    private final SolicitudPerfilRepository solicitudes;

    public ListarSolicitudesPerfilUseCase(SolicitudPerfilRepository solicitudes) {
        this.solicitudes = solicitudes;
    }

    @Transactional(readOnly = true)
    public List<SolicitudPerfilResponse> listar(int pagina, int tamano) {
        int limite = Math.min(Math.max(tamano, 1), LIMITE_MAXIMO);
        int offset = Math.max(pagina, 0) * limite;
        return solicitudes.listar(limite, offset).stream().map(SolicitudPerfilResponse::from).toList();
    }
}
