package com.sena.cold_day.core.modules.administracion.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * aux.S5.1: the auxiliar count declared on an OT is a headcount only and MUST
 * never enter the liquidation. {@code RegistrarPagoUseCase} builds the
 * {@code Liquidacion} from the technician's declared {@code montoCobrado} and
 * reads only the OT's state and technician, so the amount the technician is
 * liquidated for is identical whether the OT declares zero or N auxiliares.
 */
@ExtendWith(MockitoExtension.class)
class RegistrarPagoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);
    private static final BigDecimal PORCENTAJE_COMISION = new BigDecimal("0.15");

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock LiquidacionRepository liquidacionRepository;
    @Mock ApplicationEventPublisher events;

    private RegistrarPagoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new RegistrarPagoUseCase(otRepository, tecnicoRepository, liquidacionRepository,
                events, Clock.fixed(AHORA, ZoneOffset.UTC), PORCENTAJE_COMISION);
    }

    @Test
    void laLiquidacionCobraSoloElMontoDeclaradoSinImportarLosAuxiliares() {
        Tecnico tecnico = tecnicoAprobado();
        Ot ot = otFinalizada(tecnico.getId(), 3);
        cuandoLaLiquidacionEsNueva(ot, tecnico);

        LiquidacionResponse response = useCase.registrar(PRINCIPAL, ot.getId(),
                new BigDecimal("500000.00"), MedioPago.EFECTIVO);

        // The auxiliar headcount is visible on the OT...
        assertThat(ot.getAuxiliaresRequeridos()).isEqualTo(3);
        // ...but it contributes no amount: 500,000 * 0.15 = 75,000 is the whole
        // liquidation, derived only from the declared montoCobrado.
        assertThat(response.montoCobrado()).isEqualByComparingTo("500000.00");
        assertThat(response.valorComision()).isEqualByComparingTo("75000.00");
    }

    @Test
    void laLiquidacionEsIdenticaConCeroAuxiliaresQueConTres() {
        Tecnico tecnico = tecnicoAprobado();
        Ot sinAuxiliares = otFinalizada(tecnico.getId(), 0);
        Ot conAuxiliares = otFinalizada(tecnico.getId(), 3);

        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.buscarPorId(sinAuxiliares.getId())).thenReturn(Optional.of(sinAuxiliares));
        when(otRepository.buscarPorId(conAuxiliares.getId())).thenReturn(Optional.of(conAuxiliares));
        when(liquidacionRepository.buscarPorOt(any())).thenReturn(Optional.empty());
        when(liquidacionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LiquidacionResponse sin = useCase.registrar(PRINCIPAL, sinAuxiliares.getId(),
                new BigDecimal("500000.00"), MedioPago.EFECTIVO);
        LiquidacionResponse con = useCase.registrar(PRINCIPAL, conAuxiliares.getId(),
                new BigDecimal("500000.00"), MedioPago.EFECTIVO);

        assertThat(con.montoCobrado()).isEqualByComparingTo(sin.montoCobrado());
        assertThat(con.valorComision()).isEqualByComparingTo(sin.valorComision());
        assertThat(con.montoCobrado()).isEqualByComparingTo("500000.00");
    }

    private void cuandoLaLiquidacionEsNueva(Ot ot, Tecnico tecnico) {
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.buscarPorOt(ot.getId())).thenReturn(Optional.empty());
        when(liquidacionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Tecnico tecnicoAprobado() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        return tecnico;
    }

    private Ot otFinalizada(TecnicoId tecnicoId, int auxiliaresRequeridos) {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8939, -72.5078), EstadoOt.FINALIZADA, 10.0,
                AHORA.plusSeconds(3600), AHORA, AHORA, AHORA, null, null, null, null, null, null, null,
                auxiliaresRequeridos);
    }
}
