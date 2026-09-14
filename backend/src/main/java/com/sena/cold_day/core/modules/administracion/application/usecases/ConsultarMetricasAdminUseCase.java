package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse;
import com.sena.cold_day.core.modules.administracion.domain.repository.DisputaRepository;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;

/**
 * CU-15 / RF-F1-22: tablero administrativo con servicios en ejecucion, tecnicos
 * verificados, tiempos promedio de atencion e incidencias (disputas abiertas y
 * liquidaciones por verificar).
 */
@Service
public class ConsultarMetricasAdminUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final DisputaRepository disputaRepository;
    private final LiquidacionRepository liquidacionRepository;

    public ConsultarMetricasAdminUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            DisputaRepository disputaRepository, LiquidacionRepository liquidacionRepository) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.disputaRepository = disputaRepository;
        this.liquidacionRepository = liquidacionRepository;
    }

    @Transactional(readOnly = true)
    public MetricasAdminResponse consultar() {
        Map<EstadoOt, Long> porEstado = new EnumMap<>(EstadoOt.class);
        List<Ot> todas = new ArrayList<>();
        long enEjecucion = 0;
        for (EstadoOt estado : EstadoOt.values()) {
            List<Ot> ots = otRepository.buscarPorEstado(estado);
            porEstado.put(estado, (long) ots.size());
            todas.addAll(ots);
            if (!estado.esTerminal()) {
                enEjecucion += ots.size();
            }
        }

        var tecnicos = tecnicoRepository.findByActivoTrue();
        long verificados = tecnicos.stream()
                .filter(t -> t.getEstadoValidacion() == EstadoValidacion.APROBADO).count();
        long bloqueados = tecnicos.stream()
                .filter(t -> t.getEstadoOperativo() == EstadoOperativo.BLOQUEADO_POR_LIQUIDACION)
                .count();

        Double promedioAsignacion = promedioAsignacionSegundos(todas);

        long disputasAbiertas = disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA).size();
        long liquidacionesPorVerificar = liquidacionRepository
                .buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION).size();

        return new MetricasAdminResponse(enEjecucion, porEstado, verificados, tecnicos.size(),
                bloqueados, promedioAsignacion, disputasAbiertas, liquidacionesPorVerificar);
    }

    /**
     * Tiempo promedio entre creacion y asignacion de la OT. {@code null} si aun
     * no hay asignaciones registradas.
     */
    private Double promedioAsignacionSegundos(List<Ot> ots) {
        double total = 0;
        int contadas = 0;
        for (Ot ot : ots) {
            if (ot.getCreadaEn() != null && ot.getAsignadaEn() != null) {
                total += Duration.between(ot.getCreadaEn(), ot.getAsignadaEn()).toMillis() / 1000.0;
                contadas++;
            }
        }
        return contadas == 0 ? null : total / contadas;
    }
}
