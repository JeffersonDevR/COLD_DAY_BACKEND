package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.SolicitudInsumosInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Guards of the "repuestos a posteriori" trigger (roadmap 2.4): the OT must
 * exist, the caller must hold the active technician profile bound to the OT,
 * and the OT state has to be one of the allowed non-terminal states past the
 * assignment. Everything else is delegated verbatim to
 * {@link SolicitarInsumoUseCase}.
 */
@ExtendWith(MockitoExtension.class)
class SolicitarInsumosOtUseCaseTest {

    private static final UsuarioId USUARIO_ID = new UsuarioId(77L);
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock SolicitarInsumoUseCase solicitarInsumo;
    @Mock RequerimientoInsumo requerimiento;

    private SolicitarInsumosOtUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new SolicitarInsumosOtUseCase(otRepository, tecnicoRepository, solicitarInsumo);
    }

    @Test
    void delegatesToTheBroadcastTriggerWithTheIdsResolvedFromTheOt() {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = nuevaOt(EstadoOt.EN_REPARACION, tecnicoId);
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(tecnicoId)));
        when(solicitarInsumo.solicitar(otId.valor(), tecnicoId.valor(), LINEAS, "Compresor"))
                .thenReturn(Optional.of(requerimiento));

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(USUARIO_ID, otId, LINEAS, "Compresor");

        assertThat(resultado).contains(requerimiento);
    }

    @ParameterizedTest
    @EnumSource(value = EstadoOt.class, names = {
            "ASIGNADA", "EN_CAMINO", "EN_DIAGNOSTICO", "EN_REPARACION", "DISPUTADA" })
    void anOtInAnyAllowedNonTerminalStateReachesTheBroadcastTrigger(EstadoOt estado) {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = nuevaOt(estado, tecnicoId);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, estado, tecnicoId)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(tecnicoId)));
        when(solicitarInsumo.solicitar(otId.valor(), tecnicoId.valor(), LINEAS, null))
                .thenReturn(Optional.of(requerimiento));

        assertThat(useCase.solicitar(USUARIO_ID, otId, LINEAS, null)).isPresent();
    }

    @ParameterizedTest
    @EnumSource(value = EstadoOt.class, names = {
            "SOLICITADA", "BUSCANDO_TECNICO", "FINALIZADA", "CANCELADA", "SIN_TECNICOS_DISPONIBLES" })
    void anOtOutsideTheAllowedStatesIsRejectedAndNothingIsDispatched(EstadoOt estado) {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = nuevaOt(estado, tecnicoId);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, estado, tecnicoId)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(tecnicoId)));

        assertThatThrownBy(() -> useCase.solicitar(USUARIO_ID, otId, LINEAS, null))
                .isInstanceOf(SolicitudInsumosInvalidaException.class);

        verifyNoInteractions(solicitarInsumo);
    }

    @Test
    void aTechnicianOtherThanTheAssignedOneIsForbidden() {
        TecnicoId asignado = new TecnicoId(UUID.randomUUID());
        TecnicoId otro = new TecnicoId(UUID.randomUUID());
        OtId otId = nuevaOt(EstadoOt.EN_REPARACION, asignado);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, EstadoOt.EN_REPARACION, asignado)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(otro)));

        assertThatThrownBy(() -> useCase.solicitar(USUARIO_ID, otId, LINEAS, null))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verify(solicitarInsumo, never()).solicitar(any(), any(), anyList(), any());
    }

    @Test
    void aCallerWithoutAnActiveTechnicianProfileIsRejected() {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = nuevaOt(EstadoOt.EN_REPARACION, tecnicoId);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, EstadoOt.EN_REPARACION, tecnicoId)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.solicitar(USUARIO_ID, otId, LINEAS, null))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);

        verifyNoInteractions(solicitarInsumo);
    }

    @Test
    void anUnknownOtIsNotFound() {
        OtId otId = OtId.nueva();
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.solicitar(USUARIO_ID, otId, LINEAS, null))
                .isInstanceOf(OtNoEncontradoException.class);

        verifyNoInteractions(tecnicoRepository, solicitarInsumo);
    }

    private OtId nuevaOt(EstadoOt estado, TecnicoId tecnicoId) {
        // A real id from the aggregate factory keeps valor() authoritative; the
        // guard must forward the same OT id the OT itself declares.
        Ot ot = ot(OtId.nueva(), estado, tecnicoId);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        return ot.getId();
    }

    private Ot ot(OtId id, EstadoOt estado, TecnicoId tecnicoId) {
        return Ot.reconstituir(id, null, tecnicoId, null,
                "No enciende", List.of(), "Calle 1", null, estado, 10.0,
                null, null, null, null, null,
                null, null, null, null);
    }

    private Tecnico tecnico(TecnicoId id) {
        return Tecnico.reconstituir(id, USUARIO_ID.valor(), "ID-" + id, java.util.Set.of(),
                EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO, null, java.util.Set.of(),
                true, null, false, null);
    }
}
