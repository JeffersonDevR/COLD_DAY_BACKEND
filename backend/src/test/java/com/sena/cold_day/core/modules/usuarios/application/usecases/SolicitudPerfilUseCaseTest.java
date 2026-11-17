package com.sena.cold_day.core.modules.usuarios.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.usecases.RegistrarClienteUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoPerfilRequest;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.RegistrarPerfilTecnicoUseCase;
import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilRequest;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.PerfilNoSolicitableException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilDuplicadaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilNoEncontradaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilYaResueltaException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.SolicitudPerfilRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Casos de uso del flujo PQRS de cambio de perfil (T4.2/T4.2b/T4.4). */
@ExtendWith(MockitoExtension.class)
class SolicitudPerfilUseCaseTest {

    @Mock SolicitudPerfilRepository solicitudes;
    @Mock UsuarioRepository usuarios;
    @Mock RegistrarClienteUseCase registrarCliente;
    @Mock RegistrarPerfilTecnicoUseCase registrarTecnico;

    private CrearSolicitudPerfilUseCase crear;
    private ListarSolicitudesPerfilUseCase listar;
    private ResolverSolicitudPerfilUseCase resolver;

    @BeforeEach
    void setUp() {
        crear = new CrearSolicitudPerfilUseCase(solicitudes, usuarios);
        listar = new ListarSolicitudesPerfilUseCase(solicitudes);
        resolver = new ResolverSolicitudPerfilUseCase(solicitudes, usuarios, registrarCliente, registrarTecnico);
    }

    private Usuario usuario(Rol rol) {
        return Usuario.reconstituir(7L, "Ana", "ana@example.com", "hash", "3001234567", null,
                rol, Instant.now(), false, true, 0);
    }

    private SolicitudPerfil solicitud(Rol deseado) {
        return SolicitudPerfil.reconstituir(42L, 7L, deseado, EstadoSolicitudPerfil.PENDIENTE,
                "Quiero trabajar", Instant.now(), null, null);
    }

    @Test
    void creaSolicitudPendienteParaElPrincipal() {
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.CLIENTE)));
        when(solicitudes.existePendiente(7L, Rol.TECNICO)).thenReturn(false);
        when(solicitudes.save(any(SolicitudPerfil.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = crear.crear(new UsuarioId(7L), new SolicitudPerfilRequest(Rol.TECNICO, "Quiero trabajar"));

        assertThat(response.usuarioId()).isEqualTo(7L);
        assertThat(response.perfilDeseado()).isEqualTo(Rol.TECNICO);
        assertThat(response.estado()).isEqualTo(EstadoSolicitudPerfil.PENDIENTE);
        assertThat(response.motivacion()).isEqualTo("Quiero trabajar");

        ArgumentCaptor<SolicitudPerfil> captor = ArgumentCaptor.forClass(SolicitudPerfil.class);
        verify(solicitudes).save(captor.capture());
        assertThat(captor.getValue().getUsuarioId()).isEqualTo(7L);
    }

    @Test
    void rechazaSolicitudDuplicadaAbierta() {
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.CLIENTE)));
        when(solicitudes.existePendiente(7L, Rol.TECNICO)).thenReturn(true);

        assertThatThrownBy(() -> crear.crear(new UsuarioId(7L),
                new SolicitudPerfilRequest(Rol.TECNICO, "Otra vez")))
                .isInstanceOf(SolicitudPerfilDuplicadaException.class);
        verify(solicitudes, never()).save(any());
    }

    @Test
    void rechazaPerfilIgualAlRolInicial() {
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.TECNICO)));
        when(solicitudes.existePendiente(7L, Rol.TECNICO)).thenReturn(false);

        assertThatThrownBy(() -> crear.crear(new UsuarioId(7L),
                new SolicitudPerfilRequest(Rol.TECNICO, "Quiero seguir")))
                .isInstanceOf(PerfilNoSolicitableException.class);
    }

    @Test
    void rechazaPerfilNoConmutable() {
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.CLIENTE)));
        when(solicitudes.existePendiente(7L, Rol.ADMINISTRADOR)).thenReturn(false);

        assertThatThrownBy(() -> crear.crear(new UsuarioId(7L),
                new SolicitudPerfilRequest(Rol.ADMINISTRADOR, "Quiero ser admin")))
                .isInstanceOf(PerfilNoSolicitableException.class);
    }

    @Test
    void laBandejaSiempreVaLimitada() {
        when(solicitudes.listar(50, 100)).thenReturn(List.of());

        listar.listar(2, 500);

        // El tamano se topa en 50 y la pagina se traduce a offset filas.
        verify(solicitudes).listar(50, 100);
    }

    @Test
    void aprobarAdoptaElPerfilConDesdeAdminSinCambiarElRol() {
        when(solicitudes.buscarPorId(42L)).thenReturn(Optional.of(solicitud(Rol.TECNICO)));
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.CLIENTE)));
        when(solicitudes.save(any(SolicitudPerfil.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = resolver.resolver(42L, true, null);

        verify(registrarTecnico).registrar(eq(new UsuarioId(7L)), any(TecnicoPerfilRequest.class), eq(true));
        verify(registrarCliente, never()).registrar(any(ClienteRequest.class), any(), eq(true));
        assertThat(response.estado()).isEqualTo(EstadoSolicitudPerfil.APROBADA);
        assertThat(response.resueltaEn()).isNotNull();
        assertThat(usuario(Rol.CLIENTE).getRol()).isEqualTo(Rol.CLIENTE);
    }

    @Test
    void aprobarPerfilClienteUsaElCasoDeUsoConDesdeAdmin() {
        when(solicitudes.buscarPorId(42L)).thenReturn(Optional.of(solicitud(Rol.CLIENTE)));
        when(usuarios.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(Rol.TECNICO)));
        when(solicitudes.save(any(SolicitudPerfil.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = resolver.resolver(42L, true, null);

        verify(registrarCliente).registrar(any(ClienteRequest.class), eq(new UsuarioId(7L)), eq(true));
        verify(registrarTecnico, never()).registrar(any(), any(), eq(true));
        assertThat(response.estado()).isEqualTo(EstadoSolicitudPerfil.APROBADA);
    }

    @Test
    void rechazarSoloMarcaLaSolicitudSinAdoptarPerfil() {
        when(solicitudes.buscarPorId(42L)).thenReturn(Optional.of(solicitud(Rol.TECNICO)));
        when(solicitudes.save(any(SolicitudPerfil.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = resolver.resolver(42L, false, "Faltan documentos");

        verify(registrarTecnico, never()).registrar(any(), any(), eq(true));
        verify(registrarCliente, never()).registrar(any(ClienteRequest.class), any(), eq(true));
        assertThat(response.estado()).isEqualTo(EstadoSolicitudPerfil.RECHAZADA);
        assertThat(response.motivoRechazo()).isEqualTo("Faltan documentos");
        assertThat(response.resueltaEn()).isNotNull();
    }

    @Test
    void resuelveSoloUnaVez() {
        SolicitudPerfil resuelta = solicitud(Rol.TECNICO);
        resuelta.aprobar(Instant.now());
        when(solicitudes.buscarPorId(42L)).thenReturn(Optional.of(resuelta));

        assertThatThrownBy(() -> resolver.resolver(42L, true, null))
                .isInstanceOf(SolicitudPerfilYaResueltaException.class);
        verify(solicitudes, never()).save(any());
    }

    @Test
    void solicitudInexistente() {
        when(solicitudes.buscarPorId(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.resolver(42L, true, null))
                .isInstanceOf(SolicitudPerfilNoEncontradaException.class);
    }
}
