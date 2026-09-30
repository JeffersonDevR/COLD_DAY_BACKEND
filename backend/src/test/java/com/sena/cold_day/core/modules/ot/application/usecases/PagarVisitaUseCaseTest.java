package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

@ExtendWith(MockitoExtension.class)
class PagarVisitaUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-25T10:00:00Z");

    @Mock ClienteRepository clienteRepository;
    @Mock OtRepository otRepository;
    @Mock IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    @Mock Cliente cliente;

    private PagarVisitaUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new PagarVisitaUseCase(clienteRepository, otRepository, iniciarBusqueda,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void registraElPagoYSoloDespuesIniciaLaBroadcast() {
        UsuarioId usuarioId = new UsuarioId(7L);
        Ot ot = Ot.crear(com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId.nueva(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(7.89, -72.49), AHORA);
        ot.registrarTarifaVisita(new java.math.BigDecimal("30000"), 2.5, TarifaFuente.LINEAL, AHORA);

        when(clienteRepository.findByUsuarioId(usuarioId)).thenReturn(Optional.of(cliente));
        when(cliente.getId()).thenReturn(ot.getClienteId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(iniciarBusqueda.iniciar(ot)).thenAnswer(invocation -> {
            ot.iniciarBusqueda(10.0, AHORA.plusSeconds(60), ActorOt.CLIENTE, AHORA);
            return ot;
        });

        var resultado = useCase.pagar(usuarioId, ot.getId(), "TARJETA");

        assertThat(resultado.estado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(resultado.visitaPagada()).isTrue();
        assertThat(resultado.medioPagoVisita()).isEqualTo("TARJETA");
        verify(iniciarBusqueda).iniciar(ot);
    }
}
