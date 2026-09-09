package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.DocumentacionIncompletaException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;

@ExtendWith(MockitoExtension.class)
class TecnicosUseCaseTest {

    @Mock TecnicoRepository repository;
    @Mock com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository usuarioRepository;
    @Mock com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort passwordEncoder;
    @Mock DocumentoTecnicoRepository documentoRepository;
    @Mock ApplicationEventPublisher events;
    @Spy TecnicoMapper mapper = new TecnicoMapper();
    @InjectMocks RegistrarTecnicoUseCase registrar;
    @InjectMocks BuscarTecnicoUseCase buscar;
    @InjectMocks ActualizarTecnicoUseCase actualizar;
    @InjectMocks EliminarTecnicoUseCase eliminar;
    @InjectMocks CambiarDisponibilidadUseCase cambiarDisponibilidad;
    @InjectMocks ValidarDocumentacionTecnicoUseCase validarDocumentacion;

    private TecnicoRequest request(String numeroIdentificacion) {
        return new TecnicoRequest("Ana", "ana@example.com", "secreto", "3001234567", numeroIdentificacion, null,
                Set.of(CategoriaServicio.REFRIGERACION),
                Set.of(new Certificacion("Tecnico en refrigeracion", "SENA", LocalDate.of(2027, 1, 31))));
    }

    private Usuario usuario(Long id) {
        return Usuario.reconstituir(id, "Ana", "ana@example.com", "hash", "3001234567", null,
                com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol.TECNICO,
                java.time.LocalDateTime.now(), false, true);
    }

    @Test
    void registrarCreatesTwoAggregatesBornPending() {
        when(usuarioRepository.existeCorreo("ana@example.com")).thenReturn(false);
        when(usuarioRepository.save(any(Usuario.class))).thenReturn(
                Usuario.reconstituir(10L, "Ana", "ana@example.com", "hash", null, null,
                        com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol.TECNICO,
                        java.time.LocalDateTime.now(), false, true));
        when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> {
            Tecnico toSave = invocation.getArgument(0);
            return Tecnico.reconstituir(10L, 10L, toSave.getNumeroIdentificacion(), toSave.getFotoUrl(),
                    toSave.getCategoriasServicio(), toSave.getEstadoOperativo(), toSave.getEstadoValidacion(),
                    toSave.getMotivoRechazoValidacion(), toSave.getCertificaciones(), toSave.isActivo());
        });

        var response = registrar.registrar(request("123"));

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.usuarioId()).isEqualTo(10L);
        assertThat(response.estadoValidacion()).isEqualTo(EstadoValidacion.PENDIENTE);
        assertThat(response.categoriasServicio()).contains(CategoriaServicio.REFRIGERACION);
        assertThat(response.certificaciones()).hasSize(1);
    }

    @Test
    void registrarRejectsDuplicateCorreo() {
        when(usuarioRepository.existeCorreo("ana@example.com")).thenReturn(true);
        assertThatThrownBy(() -> registrar.registrar(request("123")))
                .isInstanceOf(com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException.class);
    }

    @Test
    void listarCombinesUsuarioAndTecnico() {
        Tecnico tecnico = Tecnico.reconstituir(10L, 10L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByActivoTrue()).thenReturn(List.of(tecnico));
        when(usuarioRepository.buscarPorId(new com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId(10L)))
                .thenReturn(Optional.of(usuario(10L)));

        var responses = buscar.listar();

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).nombre()).isEqualTo("Ana");
    }

    @Test
    void obtenerCombinesUsuarioAndTecnico() {
        Tecnico tecnico = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(tecnico));
        when(usuarioRepository.buscarPorId(new com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId(5L)))
                .thenReturn(Optional.of(usuario(5L)));

        var response = buscar.obtener(5L);
        assertThat(response.nombre()).isEqualTo("Ana");
        assertThat(response.correo()).isEqualTo("ana@example.com");
        assertThat(response.numeroIdentificacion()).isEqualTo("123");
    }

    @Test
    void actualizarUpdatesBothAggregates() {
        Tecnico existing = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        when(usuarioRepository.buscarPorId(new com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId(5L)))
                .thenReturn(Optional.of(usuario(5L)));
        when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var updated = actualizar.actualizar(5L, request("456"));

        assertThat(updated.numeroIdentificacion()).isEqualTo("456");
        assertThat(updated.nombre()).isEqualTo("Ana");
        verify(repository).save(existing);
        verify(usuarioRepository).save(any(Usuario.class));
    }

    @Test
    void eliminarSetsActivoFalse() {
        Tecnico existing = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        eliminar.eliminar(5L);
        assertThat(existing.isActivo()).isFalse();
        verify(repository).save(existing);
    }

    @Test
    void aprobarRequiresVigenteDocuments() {
        Tecnico existing = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));

        when(documentoRepository.buscarPorTecnico(5L)).thenReturn(List.of(
                new com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico(1L, 5L, "IMG",
                        LocalDate.of(2027, 1, 31))));
        when(repository.save(existing)).thenReturn(existing);

        validarDocumentacion.aprobar(5L);
        assertThat(existing.getEstadoValidacion()).isEqualTo(EstadoValidacion.APROBADO);
        verify(events).publishEvent(new com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidado(5L));
    }

    @Test
    void aprobarRejectsIncompleteDocuments() {
        Tecnico existing = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        when(documentoRepository.buscarPorTecnico(5L)).thenReturn(List.of(
                new com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico(1L, 5L, "IMG",
                        LocalDate.of(2020, 1, 31))));

        assertThatThrownBy(() -> validarDocumentacion.aprobar(5L))
                .isInstanceOf(DocumentacionIncompletaException.class);
    }

    @Test
    void rechazarRecordsMotivoAndPublishesEvent() {
        Tecnico existing = Tecnico.reconstituir(5L, 5L, "123", null, Set.of(), null, EstadoValidacion.PENDIENTE,
                null, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        validarDocumentacion.rechazar(5L, "Docs borrosos");

        assertThat(existing.getEstadoValidacion()).isEqualTo(EstadoValidacion.RECHAZADO);
        assertThat(existing.getMotivoRechazoValidacion()).isEqualTo("Docs borrosos");
        verify(events).publishEvent(
                new com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidacionRechazada(5L, "Docs borrosos"));
    }
}
