package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

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
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

@ExtendWith(MockitoExtension.class)
class CalificarOtUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-25T10:00:00Z");

    @Mock ClienteRepository clienteRepository;
    @Mock OtRepository otRepository;
    @Mock Cliente cliente;

    @Test
    void registraLaCalificacionDeUnaOtFinalizada() {
        UsuarioId usuarioId = new UsuarioId(9L);
        Ot ot = Ot.reconstituir(
                com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId.nueva(),
                com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId.nueva(), null,
                CategoriaServicio.REFRIGERACION, "Falla", List.of(), "Calle 1",
                new Point(7.89, -72.49), EstadoOt.EN_CAMINO, 10, null, AHORA, null, null,
                null, null, null, null, null, null, null, 0);
        ot.confirmarLlegada(ActorOt.TECNICO, AHORA.plusSeconds(120));
        ot.registrarDiagnostico(new com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico(
                "Falla", null, AHORA.plusSeconds(130)), ActorOt.TECNICO, AHORA.plusSeconds(130));
        ot.presupuestar(new com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto(
                java.math.BigDecimal.TEN, java.math.BigDecimal.ZERO, AHORA.plusSeconds(130)));
        ot.aprobarPresupuesto(ActorOt.CLIENTE, AHORA.plusSeconds(140));
        ot.finalizar(ActorOt.TECNICO, AHORA.plusSeconds(150));

        when(clienteRepository.findByUsuarioId(usuarioId)).thenReturn(Optional.of(cliente));
        when(cliente.getId()).thenReturn(ot.getClienteId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(otRepository.save(ot)).thenReturn(ot);

        var resultado = new CalificarOtUseCase(clienteRepository, otRepository,
                Clock.fixed(AHORA.plusSeconds(200), ZoneOffset.UTC)).calificar(usuarioId, ot.getId(), 5, "Excelente");

        assertThat(resultado.estado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(resultado.calificacionEstrellas()).isEqualTo(5);
        assertThat(resultado.calificacionComentario()).isEqualTo("Excelente");
    }
}
