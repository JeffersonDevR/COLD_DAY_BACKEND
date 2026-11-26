package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.IncumplimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/** Read side for the administrator: the recent ETA breaches with the supplier's name. */
@Service
public class ListarIncumplimientosUseCase {

    private final IncumplimientoInsumoRepository incumplimientoRepository;
    private final ProveedorRepository proveedorRepository;

    public ListarIncumplimientosUseCase(IncumplimientoInsumoRepository incumplimientoRepository,
            ProveedorRepository proveedorRepository) {
        this.incumplimientoRepository = incumplimientoRepository;
        this.proveedorRepository = proveedorRepository;
    }

    @Transactional(readOnly = true)
    public List<Item> listar() {
        Map<ProveedorId, String> nombres = new HashMap<>();
        return incumplimientoRepository.recientes().stream()
                .map(incumplimiento -> new Item(incumplimiento, nombres.computeIfAbsent(
                        incumplimiento.proveedorId(),
                        id -> proveedorRepository.buscarPorId(id)
                                .map(proveedor -> proveedor.getRazonSocial()).orElse(""))))
                .toList();
    }

    public record Item(IncumplimientoInsumo incumplimiento, String razonSocial) {
    }
}
