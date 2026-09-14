package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaExpiradaException;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaNoDisponibleException;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Atomic acceptance (task 6b.5, design D5/D6). The conditional UPDATE on the OT
 * is the cross-offer gate: the winner flips its own offer, invalidates the
 * siblings, becomes OCUPADO and appends the audited
 * {@code BUSCANDO_TECNICO -> ASIGNADA} transition; every loser gets a domain
 * conflict, expired offers are rejected lazily, and an offer never belongs to a
 * technician other than the authenticated one.
 */
@ExtendWith(MockitoExtension.class)
class AceptarOfertaUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(60);
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OfertaOtRepository ofertaRepository;
    @Mock OtRepository otRepository;
    @Mock OtEstadoHistorialRepository historialRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ApplicationEventPublisher events;

    private AceptarOfertaUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new AceptarOfertaUseCase(ofertaRepository, otRepository, historialRepository,
                tecnicoRepository, events, Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void theWinningAcceptAssignsTheOrderAndClosesEveryOtherOffer() {
        Tecnico tecnico = tecnicoDisponible();
        TecnicoId tecnicoId = tecnico.getId();
        OtId otId = OtId.nueva();
        ClienteId clienteId = ClienteId.nueva();
        OfertaOt oferta = ofertaPendiente(otId, tecnicoId);
        cuandoElTecnicoSeResuelve(tecnico);
        cuandoLaOfertaExiste(oferta);
        when(otRepository.intentarAsignar(otId, tecnicoId, AHORA, oferta.getRadioKm())).thenReturn(1);
        when(ofertaRepository.intentarAceptar(oferta.getId(), AHORA)).thenReturn(1);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(otAsignada(otId, clienteId, tecnicoId)));

        OtResponse response = useCase.aceptar(PRINCIPAL, oferta.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.ASIGNADA);
        assertThat(response.tecnicoId()).isEqualTo(tecnicoId);

        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.OCUPADO);
        verify(tecnicoRepository).save(tecnico);
        verify(ofertaRepository).invalidarPendientesDe(otId, OfertaEstado.CANCELADA, AHORA);

        ArgumentCaptor<OtEstadoHistorial> historial = ArgumentCaptor.forClass(OtEstadoHistorial.class);
        verify(historialRepository).append(historial.capture());
        CambioEstado cambio = historial.getValue().getCambio();
        assertThat(historial.getValue().getOtId()).isEqualTo(otId);
        assertThat(cambio.origen()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(cambio.destino()).isEqualTo(EstadoOt.ASIGNADA);
        assertThat(cambio.actor()).isEqualTo(ActorOt.TECNICO);
        assertThat(cambio.ocurridoEn()).isEqualTo(AHORA);

        ArgumentCaptor<Object> publicado = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(publicado.capture());
        assertThat(publicado.getValue()).isEqualTo(new OtAsignada(otId, tecnicoId, clienteId));
    }

    @Test
    void anExpiredOfferIsRejectedLazilyWithoutAssigningTheOrder() {
        Tecnico tecnico = tecnicoDisponible();
        OfertaOt expirada = OfertaOt.crear(OtId.nueva(), tecnico.getId(), 10.0,
                AHORA.minusSeconds(120), AHORA.minusSeconds(60));
        cuandoElTecnicoSeResuelve(tecnico);
        cuandoLaOfertaExiste(expirada);

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, expirada.getId()))
                .isInstanceOf(OfertaExpiradaException.class);

        verify(otRepository, never()).intentarAsignar(any(), any(), any(), anyDouble());
        verify(ofertaRepository, never()).intentarAceptar(any(), any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void losingTheCrossOfferGateYieldsAConflictWithoutTouchingTheOffer() {
        Tecnico tecnico = tecnicoDisponible();
        OfertaOt oferta = ofertaPendiente(OtId.nueva(), tecnico.getId());
        cuandoElTecnicoSeResuelve(tecnico);
        cuandoLaOfertaExiste(oferta);
        when(otRepository.intentarAsignar(any(), any(), any(), anyDouble())).thenReturn(0);

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, oferta.getId()))
                .isInstanceOf(OfertaNoDisponibleException.class);

        verify(ofertaRepository, never()).intentarAceptar(any(), any());
        verify(ofertaRepository, never()).invalidarPendientesDe(any(), any(), any());
        verify(tecnicoRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void anAlreadyResolvedOfferIsUnavailable() {
        Tecnico tecnico = tecnicoDisponible();
        OfertaOt aceptada = OfertaOt.reconstituir(com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId.nueva(),
                OtId.nueva(), tecnico.getId(), 10.0, OfertaEstado.ACEPTADA, AHORA.minusSeconds(60), EXPIRA, AHORA);
        cuandoElTecnicoSeResuelve(tecnico);
        cuandoLaOfertaExiste(aceptada);

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, aceptada.getId()))
                .isInstanceOf(OfertaNoDisponibleException.class);

        verify(otRepository, never()).intentarAsignar(any(), any(), any(), anyDouble());
    }

    @Test
    void anOfferOfAnotherTechnicianIsUnavailable() {
        Tecnico tecnico = tecnicoDisponible();
        OfertaOt ajena = ofertaPendiente(OtId.nueva(), TecnicoId.nueva());
        cuandoElTecnicoSeResuelve(tecnico);
        cuandoLaOfertaExiste(ajena);

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, ajena.getId()))
                .isInstanceOf(OfertaNoDisponibleException.class);

        verify(otRepository, never()).intentarAsignar(any(), any(), any(), anyDouble());
    }

    @Test
    void anUnknownOfferIsUnavailable() {
        Tecnico tecnico = tecnicoDisponible();
        cuandoElTecnicoSeResuelve(tecnico);
        com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId desconocida =
                com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId.nueva();
        when(ofertaRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, desconocida))
                .isInstanceOf(OfertaNoDisponibleException.class);

        verify(otRepository, never()).intentarAsignar(any(), any(), any(), anyDouble());
    }

    @Test
    void aNotApprovedTechnicianCannotTakeTheAssignment() {
        Tecnico pendiente = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        OfertaOt oferta = ofertaPendiente(OtId.nueva(), pendiente.getId());
        cuandoElTecnicoSeResuelve(pendiente);
        cuandoLaOfertaExiste(oferta);
        when(otRepository.intentarAsignar(any(), any(), any(), anyDouble())).thenReturn(1);
        when(ofertaRepository.intentarAceptar(oferta.getId(), AHORA)).thenReturn(1);

        assertThatThrownBy(() -> useCase.aceptar(PRINCIPAL, oferta.getId()))
                .isInstanceOf(TecnicoNoValidadoException.class);

        verify(tecnicoRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
    }

    private Tecnico tecnicoDisponible() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        return tecnico;
    }

    private OfertaOt ofertaPendiente(OtId otId, TecnicoId tecnicoId) {
        return OfertaOt.crear(otId, tecnicoId, 10.0, AHORA, EXPIRA);
    }

    private void cuandoElTecnicoSeResuelve(Tecnico tecnico) {
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
    }

    private void cuandoLaOfertaExiste(OfertaOt oferta) {
        when(ofertaRepository.buscarPorId(oferta.getId())).thenReturn(Optional.of(oferta));
    }

    private Ot otAsignada(OtId otId, ClienteId clienteId, TecnicoId tecnicoId) {
        return Ot.reconstituir(otId, clienteId, tecnicoId, CategoriaServicio.REFRIGERACION, "No enciende",
                List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.ASIGNADA, 10.0, EXPIRA,
                AHORA, AHORA, null, null, null, null);
    }
}
