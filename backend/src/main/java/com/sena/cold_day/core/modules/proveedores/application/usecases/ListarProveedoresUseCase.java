package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;

/**
 * Admin-only supplier listing. Includes inactive suppliers (spec P4): the
 * active/inactive state is a dispatch eligibility rule (P5), never a listing
 * filter.
 */
@Service
public class ListarProveedoresUseCase {

    private final ProveedorRepository proveedorRepository;

    public ListarProveedoresUseCase(ProveedorRepository proveedorRepository) {
        this.proveedorRepository = proveedorRepository;
    }

    @Transactional(readOnly = true)
    public List<ProveedorResponse> listar() {
        return proveedorRepository.findAll().stream().map(ProveedorResponse::from).toList();
    }
}
