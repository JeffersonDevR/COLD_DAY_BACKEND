package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-20 approval (task 7.4): the owning client approves the presented budget
 * and the OT advances {@code EN_DIAGNOSTICO -> EN_REPARACION}. A client that
 * does not own the order is a 403.
 */
@ExtendWith(MockitoExtension.class)
class AprobarPresupuestoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;

    private AprobarPresupuestoUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = new AprobarPresupuestoUseCase(otRepository, clienteRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void aprobarMovesTheOrderToEnReparacion() {
        Cliente cliente = cliente();
        Ot ot = otEnDiagnostico(cliente.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.aprobar(PRINCIPAL, ot.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.EN_REPARACION);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.EN_REPARACION);
        });
    }

    @Test
    void aprobarRejectsAClientThatDoesNotOwnTheOrder() {
        Cliente cliente = cliente();
        Ot ot = otEnDiagnostico(ClienteId.nueva());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.aprobar(PRINCIPAL, otId))
                .isInstanceOf(OtAccesoNoPermitidoException.class);

        verify(otRepository, never()).save(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
    }

    @Test
    void aprobarRejectsAnUnknownOrder() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.aprobar(PRINCIPAL, desconocida))
                .isInstanceOf(OtNoEncontradoException.class);
    }

    private Cliente cliente() {
        return Cliente.registrar(PRINCIPAL, TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro"));
    }

    private Ot otEnDiagnostico(ClienteId clienteId) {
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"), AHORA);
        return Ot.reconstituir(OtId.nueva(), clienteId, TecnicoId.nueva(), CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.EN_DIAGNOSTICO, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, presupuesto);
    }
}
