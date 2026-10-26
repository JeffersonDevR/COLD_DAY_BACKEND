package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Guards and ordering of the parts-request read path (roadmap 2.4): unknown OT
 * is 404, only the bound technician reads it, and the listing arrives newest
 * first regardless of the repository order.
 */
@ExtendWith(MockitoExtension.class)
class ListarInsumosOtUseCaseTest {

    private static final UsuarioId USUARIO_ID = new UsuarioId(77L);

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock RequerimientoInsumoRepository requerimientoRepository;

    private ListarInsumosOtUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ListarInsumosOtUseCase(otRepository, tecnicoRepository, requerimientoRepository);
    }

    @Test
    void returnsTheRequestsOfTheOtNewestFirst() {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = OtId.nueva();
        Ot ot = ot(otId, EstadoOt.EN_REPARACION, tecnicoId);
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(tecnicoId)));
        RequerimientoInsumo viejo = requerimiento(Instant.parse("2026-10-01T10:00:00Z"));
        RequerimientoInsumo nuevo = requerimiento(Instant.parse("2026-10-02T10:00:00Z"));
        RequerimientoInsumo intermedio = requerimiento(Instant.parse("2026-10-01T18:00:00Z"));
        when(requerimientoRepository.buscarPorOt(otId.valor()))
                .thenReturn(List.of(viejo, intermedio, nuevo));

        List<RequerimientoInsumo> resultado = useCase.listar(USUARIO_ID, otId);

        assertThat(resultado).containsExactly(nuevo, intermedio, viejo);
    }

    @Test
    void anOtWithoutRequestsYieldsAnEmptyList() {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = OtId.nueva();
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, EstadoOt.FINALIZADA, tecnicoId)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(tecnicoId)));
        when(requerimientoRepository.buscarPorOt(otId.valor())).thenReturn(List.of());

        assertThat(useCase.listar(USUARIO_ID, otId)).isEmpty();
    }

    @Test
    void aTechnicianOtherThanTheAssignedOneIsForbidden() {
        TecnicoId asignado = new TecnicoId(UUID.randomUUID());
        TecnicoId otro = new TecnicoId(UUID.randomUUID());
        OtId otId = OtId.nueva();
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, EstadoOt.EN_REPARACION, asignado)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor()))
                .thenReturn(Optional.of(tecnico(otro)));

        assertThatThrownBy(() -> useCase.listar(USUARIO_ID, otId))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verifyNoInteractions(requerimientoRepository);
    }

    @Test
    void aCallerWithoutAnActiveTechnicianProfileIsRejected() {
        TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
        OtId otId = OtId.nueva();
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.of(ot(otId, EstadoOt.EN_REPARACION, tecnicoId)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID.valor())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.listar(USUARIO_ID, otId))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);

        verifyNoInteractions(requerimientoRepository);
    }

    @Test
    void anUnknownOtIsNotFound() {
        OtId otId = OtId.nueva();
        when(otRepository.buscarPorId(otId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.listar(USUARIO_ID, otId))
                .isInstanceOf(OtNoEncontradoException.class);

        verifyNoInteractions(tecnicoRepository, requerimientoRepository);
    }

    private Ot ot(OtId id, EstadoOt estado, TecnicoId tecnicoId) {
        return Ot.reconstituir(id, null, tecnicoId, null,
                "No enciende", List.of(), "Calle 1", null, estado, 10.0,
                null, null, null, null, null,
                null, null, null, null);
    }

    private Tecnico tecnico(TecnicoId id) {
        return Tecnico.reconstituir(id, USUARIO_ID.valor(), "ID-" + id, Set.of(),
                EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO, null, Set.of(),
                true, null, false, null);
    }

    private RequerimientoInsumo requerimiento(Instant creadaEn) {
        return RequerimientoInsumo.reconstituir(
                com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId.nueva(),
                UUID.randomUUID(), UUID.randomUUID(), null, null, List.of(), creadaEn, null, null);
    }
}
