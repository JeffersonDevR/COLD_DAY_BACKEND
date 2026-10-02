package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

@ExtendWith(MockitoExtension.class)
class CalificarOtUseCaseTest {

    private static final ClienteId CLIENTE = ClienteId.nueva();
    private static final TecnicoId TECNICO = TecnicoId.nueva();
    private static final Instant AHORA = Instant.parse("2026-09-25T10:00:00Z");

    @Mock ClienteRepository clienteRepository;
    @Mock OtRepository otRepository;
    @Mock Cliente cliente;

    /**
     * Rating only applies to a FINALIZADA order that somebody actually served,
     * so the fixture walks the real state machine from ASIGNADA with an assigned
     * technician. Building the OT at EN_CAMINO with no technician (the previous
     * shape) made confirmarLlegada throw before calificar was ever reached: the
     * test asserted on a rating that never happened.
     */
    @Test
    void registraLaCalificacionDeUnaOtFinalizada() {
        UsuarioId usuarioId = new UsuarioId(9L);
        Ot ot = otFinalizada();

        when(clienteRepository.findByUsuarioId(usuarioId)).thenReturn(Optional.of(cliente));
        when(cliente.getId()).thenReturn(ot.getClienteId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(otRepository.save(ot)).thenReturn(ot);

        var resultado = new CalificarOtUseCase(clienteRepository, otRepository,
                Clock.fixed(AHORA.plusSeconds(200), ZoneOffset.UTC)).calificar(usuarioId, ot.getId(), 5, "Excelente");

        assertThat(resultado.estado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(resultado.calificacionEstrellas()).isEqualTo(5);
        assertThat(resultado.calificacionComentario()).isEqualTo("Excelente");
        assertThat(resultado.calificacionEn()).isEqualTo(AHORA.plusSeconds(200));
        // The rating is about a person, so it freezes whoever served the order.
        assertThat(ot.getCalificacionTecnicoId()).isEqualTo(TECNICO);
    }

    private Ot otFinalizada() {
        Ot ot = Ot.reconstituir(OtId.nueva(), CLIENTE, TECNICO, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.89, -72.49), EstadoOt.ASIGNADA, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null);
        ot.drenarCambiosPendientes();
        ot.iniciarDesplazamiento(ActorOt.TECNICO, AHORA.plusSeconds(30));
        ot.confirmarLlegada(ActorOt.TECNICO, AHORA.plusSeconds(120));
        ot.registrarDiagnostico(new Diagnostico("Compresor averiado", "Revisado en sitio",
                AHORA.plusSeconds(130)), ActorOt.TECNICO, AHORA.plusSeconds(130));
        ot.presupuestar(new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"),
                AHORA.plusSeconds(130)));
        ot.aprobarPresupuesto(ActorOt.CLIENTE, AHORA.plusSeconds(140));
        ot.finalizar(ActorOt.TECNICO, AHORA.plusSeconds(150));
        return ot;
    }
}