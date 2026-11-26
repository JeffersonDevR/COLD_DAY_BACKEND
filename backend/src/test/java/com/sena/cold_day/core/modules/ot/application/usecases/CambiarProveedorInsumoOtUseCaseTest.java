package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.application.usecases.CambiarProveedorInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@ExtendWith(MockitoExtension.class)
class CambiarProveedorInsumoOtUseCaseTest {

    @Mock TecnicoRepository tecnicoRepository;
    @Mock CambiarProveedorInsumoUseCase cambiarProveedor;
    @Mock Tecnico tecnico;
    @InjectMocks CambiarProveedorInsumoOtUseCase useCase;

    @Test
    void delegaConElTecnicoDelUsuarioAutenticado() {
        UUID tecnicoId = UUID.randomUUID();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(7L)).thenReturn(Optional.of(tecnico));
        when(tecnico.getId()).thenReturn(new TecnicoId(tecnicoId));

        useCase.cambiar(new UsuarioId(7L), id);

        verify(cambiarProveedor).cambiar(id, tecnicoId);
    }

    @Test
    void sinPerfilDeTecnicoNoCambiaNada() {
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.cambiar(new UsuarioId(7L), RequerimientoInsumoId.nueva()))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);

        verifyNoInteractions(cambiarProveedor);
    }
}
