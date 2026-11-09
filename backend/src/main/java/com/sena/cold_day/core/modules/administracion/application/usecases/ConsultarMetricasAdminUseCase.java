package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse;
import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse.DistribucionCategoria;
import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse.HistoricoDia;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.repository.DisputaRepository;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtMetrica;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;

/**
 * CU-15 / RF-F1-22: tablero administrativo con servicios en ejecucion, tecnicos
 * verificados, tiempos promedio de atencion e incidencias (disputas abiertas y
 * liquidaciones por verificar).
 *
 * <p>Lee las OT como proyeccion ({@link OtMetrica}): una sola query de cinco
 * columnas. Antes hacia diez consultas (una por estado) y cargaba cada OT como
 * agregado completo en memoria; con el historico de la plataforma eso era un
 * bucle de memoria proporcional al uso, y el tablero se refresca por SSE.
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
        List<OtMetrica> ots = otRepository.resumenParaMetricas();

        Map<EstadoOt, Long> porEstado = new EnumMap<>(EstadoOt.class);
        for (EstadoOt estado : EstadoOt.values()) {
            porEstado.put(estado, 0L);
        }
        for (OtMetrica ot : ots) {
            porEstado.merge(ot.estado(), 1L, Long::sum);
        }
        long enEjecucion = porEstado.entrySet().stream()
                .filter(entrada -> !entrada.getKey().esTerminal())
                .mapToLong(Map.Entry::getValue)
                .sum();

        List<com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico> tecnicos =
                tecnicoRepository.findByActivoTrue();
        long verificados = tecnicos.stream()
                .filter(t -> t.getEstadoValidacion() == EstadoValidacion.APROBADO).count();
        long bloqueados = tecnicos.stream()
                .filter(t -> t.getEstadoOperativo() == EstadoOperativo.BLOQUEADO_POR_LIQUIDACION).count();
        long disponibles = tecnicos.stream()
                .filter(t -> t.getEstadoOperativo() == EstadoOperativo.DISPONIBLE).count();

        Double promedioAsignacion = promedioAsignacionSegundos(ots);

        long disputasAbiertas = disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA).size();
        long liquidacionesPorVerificar = liquidacionRepository
                .buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION).size();

        BigDecimal[] recaudo = recaudoMesActual();

        return new MetricasAdminResponse(enEjecucion, porEstado, verificados, tecnicos.size(),
                bloqueados, disponibles, promedioAsignacion, disputasAbiertas, liquidacionesPorVerificar,
                recaudo[0], recaudo[1], distribucionCategorias(ots), historicoSemanal(ots));
    }

    /** Distribucion porcentual de OTs por categoria de servicio. */
    private List<DistribucionCategoria> distribucionCategorias(List<OtMetrica> ots) {
        Map<CategoriaServicio, Long> porCategoria = new EnumMap<>(CategoriaServicio.class);
        for (OtMetrica ot : ots) {
            // Una OT sin categoria no suma a ninguna barra; el total sigue siendo
            // el numero de OT, que es el denominador historico.
            if (ot.categoria() != null) {
                porCategoria.merge(ot.categoria(), 1L, Long::sum);
            }
        }
        long total = ots.size();
        List<DistribucionCategoria> distribucion = new ArrayList<>();
        for (CategoriaServicio categoria : CategoriaServicio.values()) {
            long cantidad = porCategoria.getOrDefault(categoria, 0L);
            double porcentaje = total == 0 ? 0 : Math.round((cantidad * 1000.0) / total) / 10.0;
            distribucion.add(new DistribucionCategoria(categoria, cantidad, porcentaje));
        }
        return distribucion;
    }

    /** Conteo de OTs finalizadas/canceladas por dia en la ultima semana. */
    private List<HistoricoDia> historicoSemanal(List<OtMetrica> ots) {
        String[] nombres = {"Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"};
        ZoneId zona = ZoneId.systemDefault();
        LocalDate hoy = LocalDate.now(zona);
        List<HistoricoDia> historico = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate dia = hoy.minusDays(i);
            long completadas = ots.stream()
                    .filter(o -> o.estado() == EstadoOt.FINALIZADA && o.finalizadaEn() != null
                            && o.finalizadaEn().atZone(zona).toLocalDate().equals(dia))
                    .count();
            long canceladas = ots.stream()
                    .filter(o -> o.estado() == EstadoOt.CANCELADA && o.creadaEn() != null
                            && o.creadaEn().atZone(zona).toLocalDate().equals(dia))
                    .count();
            historico.add(new HistoricoDia(nombres[dia.getDayOfWeek().getValue() % 7], completadas, canceladas));
        }
        return historico;
    }

    /** [recaudo, comisiones] de las liquidaciones registradas en el mes actual. */
    private BigDecimal[] recaudoMesActual() {
        BigDecimal recaudo = BigDecimal.ZERO;
        BigDecimal comisiones = BigDecimal.ZERO;
        ZoneId zona = ZoneId.systemDefault();
        YearMonth mes = YearMonth.now(zona);
        for (Liquidacion liquidacion : liquidacionRepository.listarTodas()) {
            if (liquidacion.getCreadaEn() == null
                    || !YearMonth.from(liquidacion.getCreadaEn().atZone(zona)).equals(mes)) {
                continue;
            }
            if (liquidacion.getMontoCobrado() != null) {
                recaudo = recaudo.add(liquidacion.getMontoCobrado());
            }
            if (liquidacion.getValorComision() != null) {
                comisiones = comisiones.add(liquidacion.getValorComision());
            }
        }
        return new BigDecimal[] {recaudo, comisiones};
    }

    /**
     * Tiempo promedio entre creacion y asignacion de la OT. {@code null} si aun
     * no hay asignaciones registradas.
     */
    private Double promedioAsignacionSegundos(List<OtMetrica> ots) {
        double total = 0;
        int contadas = 0;
        for (OtMetrica ot : ots) {
            Instant creada = ot.creadaEn();
            Instant asignada = ot.asignadaEn();
            if (creada != null && asignada != null) {
                total += Duration.between(creada, asignada).toMillis() / 1000.0;
                contadas++;
            }
        }
        return contadas == 0 ? null : total / contadas;
    }
}
