package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.events.DocumentoPorVencer;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.services.NotificacionVigenciaPort;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.AudienciaNotificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Daily vigencia sweep (RF-F1-03, CU-03): pre-expiry notice inside the 30-day
 * window without suspending; already-expired documents/certifications suspend.
 * The use case is invoked directly with a fixed date — no scheduler wait.
 */
@ExtendWith(MockitoExtension.class)
class VerificarVigenciaDocumentalUseCaseTest {

    private static final TecnicoId TECNICO_ID = TecnicoId.desde(UUID.randomUUID());

    @Mock TecnicoRepository tecnicoRepository;
    @Mock DocumentoTecnicoRepository documentoRepository;
    @Mock NotificacionVigenciaPort notificacion;
    @InjectMocks VerificarVigenciaDocumentalUseCase useCase;

    private final LocalDate hoy = LocalDate.of(2026, 9, 13);

    private Tecnico aprobado(Set<Certificacion> certificaciones) {
        return Tecnico.reconstituir(TECNICO_ID, 5L, "123", Set.of(), EstadoOperativo.FUERA_DE_SERVICIO,
                EstadoValidacion.APROBADO, null, certificaciones, true);
    }

    @Test
    void notifiesTechnicianAndAdministratorWithinThirtyDaysWithoutSuspending() {
        Tecnico tecnico = aprobado(Set.of());
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(tecnico));
        when(documentoRepository.buscarPorTecnico(TECNICO_ID))
                .thenReturn(List.of(new DocumentoTecnico(1L, TECNICO_ID, "Cedula", hoy.plusDays(30))));

        useCase.ejecutar(hoy);

        ArgumentCaptor<DocumentoPorVencer> captor = ArgumentCaptor.forClass(DocumentoPorVencer.class);
        verify(notificacion).notificarProximoVencimiento(captor.capture());
        DocumentoPorVencer aviso = captor.getValue();
        assertThat(aviso.tecnicoId()).isEqualTo(TECNICO_ID);
        assertThat(aviso.documento()).isEqualTo("Cedula");
        assertThat(aviso.fechaVencimiento()).isEqualTo(hoy.plusDays(30));
        assertThat(aviso.diasRestantes()).isEqualTo(30);
        assertThat(aviso.audiencias()).containsExactlyInAnyOrder(AudienciaNotificacion.TECNICO,
                AudienciaNotificacion.ADMINISTRADOR);
        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.APROBADO);
        verify(tecnicoRepository, never()).save(any());
    }

    @Test
    void doesNotNotifyOutsideTheThirtyDayWindow() {
        Tecnico tecnico = aprobado(Set.of());
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(tecnico));
        when(documentoRepository.buscarPorTecnico(TECNICO_ID))
                .thenReturn(List.of(new DocumentoTecnico(1L, TECNICO_ID, "Cedula", hoy.plusDays(31))));

        useCase.ejecutar(hoy);

        verifyNoInteractions(notificacion);
        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.APROBADO);
    }

    @Test
    void suspendsAnApprovedTechnicianWhenADocumentIsAlreadyExpired() {
        Tecnico tecnico = aprobado(Set.of());
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(tecnico));
        when(documentoRepository.buscarPorTecnico(TECNICO_ID))
                .thenReturn(List.of(new DocumentoTecnico(1L, TECNICO_ID, "Cedula", hoy.minusDays(1))));

        useCase.ejecutar(hoy);

        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.SUSPENDIDO);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);
        verify(tecnicoRepository).save(tecnico);
        verifyNoInteractions(notificacion);
    }

    @Test
    void suspendsWhenACertificationIsAlreadyExpired() {
        Certificacion expired = new Certificacion("Tecnico", "SENA", LocalDate.of(2020, 1, 1), hoy.minusDays(1));
        Tecnico tecnico = aprobado(Set.of(expired));
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(tecnico));
        when(documentoRepository.buscarPorTecnico(TECNICO_ID)).thenReturn(List.of());

        useCase.ejecutar(hoy);

        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.SUSPENDIDO);
        verify(tecnicoRepository).save(tecnico);
        verifyNoInteractions(notificacion);
    }

    @Test
    void ignoresTechniciansThatAreNotApproved() {
        Tecnico pendiente = Tecnico.reconstituir(TECNICO_ID, 5L, "123", Set.of(), EstadoOperativo.FUERA_DE_SERVICIO,
                EstadoValidacion.PENDIENTE, null, Set.of(), true);
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(pendiente));

        useCase.ejecutar(hoy);

        verifyNoInteractions(documentoRepository);
        verifyNoInteractions(notificacion);
    }
}
