package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Push de presupuesto, aceptacion y aprobacion: solo tras el commit y sin romper nada. */
class OtPushListenerTest {

    private final OtRepository otRepository = mock(OtRepository.class);
    private final NotificacionPushPort push = mock(NotificacionPushPort.class);
    private final OtPushListener listener = new OtPushListener(otRepository, push);

    private final OtId otId = new OtId(UUID.randomUUID());
    private final ClienteId clienteId = ClienteId.nueva();
    private final TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
    private final Ot ot = mock(Ot.class);

    private void otCargada() {
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot));
        when(ot.getClienteId()).thenReturn(clienteId);
        when(ot.getTecnicoId()).thenReturn(tecnicoId);
    }

    @Test
    void presupuestoEnviadoNotificaAlCliente() {
        otCargada();

        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.EN_CAMINO, EstadoOt.EN_DIAGNOSTICO));

        verify(push).notificarPresupuestoEnviado(clienteId, ot);
    }

    @Test
    void presupuestoAprobadoNotificaAlTecnico() {
        otCargada();

        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.EN_DIAGNOSTICO, EstadoOt.EN_REPARACION));

        verify(push).notificarPresupuestoAprobado(tecnicoId, ot);
    }

    @Test
    void otAceptadaNotificaAlCliente() {
        otCargada();

        listener.alAsignar(new OtAsignada(otId, tecnicoId, clienteId));

        verify(push).notificarOtAceptada(clienteId, ot);
    }

    @Test
    void unaTransicionSinPushNoEnviaNada() {
        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO));
        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.EN_REPARACION, EstadoOt.FINALIZADA));

        verifyNoInteractions(push);
    }

    @Test
    void aprobacionSinTecnicoNoEnviaNada() {
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot));
        when(ot.getTecnicoId()).thenReturn(null);

        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.EN_DIAGNOSTICO, EstadoOt.EN_REPARACION));

        verifyNoInteractions(push);
    }

    @Test
    void siElRepositorioFallaElListenerNoLanzaNiEnvia() {
        when(otRepository.buscarPorId(otId)).thenThrow(new IllegalStateException("bd caida"));

        listener.alCambiarEstado(new OtEstadoCambiado(otId, EstadoOt.EN_CAMINO, EstadoOt.EN_DIAGNOSTICO));
        listener.alAsignar(new OtAsignada(otId, tecnicoId, clienteId));

        verifyNoInteractions(push);
    }
}
