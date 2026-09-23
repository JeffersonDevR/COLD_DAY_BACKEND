package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.usecases.CancelarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.FinalizarOtUseCase;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Authoritative tariff persistence (spec tar.R6, design AD9/AD13). The tariff is
 * computed server-side and written to {@code ot.tarifa_visita},
 * {@code ot.distancia_km} and {@code ot.tarifa_fuente} only at
 * finalization/cancellation; the acceptance gate persists nothing. Maps is not
 * configured in tests, so the Haversine fallback runs and the source is
 * {@code LINEAL}.
 */
@SpringBootTest
@TestPropertySource(properties = "app.maps.enabled=false")
class TarifaPersistenciaIT {

    // Inside the metropolitan radius of the configured service center.
    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);

    @Autowired FinalizarOtUseCase finalizarOtUseCase;
    @Autowired CancelarOtUseCase cancelarOtUseCase;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void finalizarPersisteLaTarifaAutoritativaConDistanciaYFuente() {
        Fixture f = fixture();
        Ot ot = otEnEstado(f.clienteId(), f.tecnicoId(), EstadoOt.EN_REPARACION, Instant.now());

        finalizarOtUseCase.finalizar(new UsuarioId(f.tecnicoUsuario()), ot.getId());

        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(persisted -> {
            assertThat(persisted.getEstado()).isEqualTo(EstadoOt.FINALIZADA);
            assertThat(persisted.getTarifaVisita()).isEqualByComparingTo("30000");
            assertThat(persisted.getDistanciaKm()).isZero();
            assertThat(persisted.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
        });
    }

    @Test
    void cancelarFueraDeLaVentanaGratuitaPersisteLaTarifaAutoritativa() {
        Fixture f = fixture();
        Ot ot = otEnEstado(f.clienteId(), f.tecnicoId(), EstadoOt.ASIGNADA,
                Instant.now().minus(Duration.ofMinutes(20)));

        cancelarOtUseCase.cancelar(new UsuarioId(f.clienteUsuario()), Rol.CLIENTE, ot.getId(), "Tarde");

        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(persisted -> {
            assertThat(persisted.getEstado()).isEqualTo(EstadoOt.CANCELADA);
            assertThat(persisted.getTarifaVisita()).isEqualByComparingTo("30000");
            assertThat(persisted.getDistanciaKm()).isZero();
            assertThat(persisted.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
        });
    }

    @Test
    void cancelarDentroDeLaVentanaGratuitaNoPersisteTarifaNiDistanciaNiFuente() {
        Fixture f = fixture();
        Ot ot = otEnEstado(f.clienteId(), f.tecnicoId(), EstadoOt.ASIGNADA, Instant.now());

        cancelarOtUseCase.cancelar(new UsuarioId(f.clienteUsuario()), Rol.CLIENTE, ot.getId(), "Me arrepenti");

        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(persisted -> {
            assertThat(persisted.getEstado()).isEqualTo(EstadoOt.CANCELADA);
            assertThat(persisted.getTarifaVisita()).isNull();
            assertThat(persisted.getDistanciaKm()).isNull();
            assertThat(persisted.getTarifaFuente()).isNull();
        });
    }

    @Test
    void laAceptacionDeUnaOfertaNoPersisteTarifa() {
        Fixture f = fixture();
        Ot ot = otBuscandoTecnico(f.clienteId());

        int ganador = otRepository.intentarAsignar(ot.getId(), f.tecnicoId(), Instant.now(), 10.0);

        assertThat(ganador).isEqualTo(1);
        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(persisted -> {
            assertThat(persisted.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(persisted.getTarifaVisita()).isNull();
            assertThat(persisted.getDistanciaKm()).isNull();
            assertThat(persisted.getTarifaFuente()).isNull();
        });
    }

    private Fixture fixture() {
        Long clienteUsuario = crearUsuario("cliente-tarifa@example.com", Rol.CLIENTE);
        Cliente cliente = clienteRepository.save(Cliente.registrar(new UsuarioId(clienteUsuario),
                TipoCliente.B2C, DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
        Long tecnicoUsuario = crearUsuario("tecnico-tarifa@example.com", Rol.TECNICO);
        Tecnico tecnico = Tecnico.crear(tecnicoUsuario, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.aceptarOrden();
        TecnicoId tecnicoId = tecnicoRepository.save(tecnico).getId();
        return new Fixture(clienteUsuario, cliente.getId(), tecnicoUsuario, tecnicoId);
    }

    private Ot otEnEstado(ClienteId clienteId, TecnicoId tecnicoId, EstadoOt estado, Instant asignadaEn) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), asignadaEn, null, null, null, null, null,
                null);
        return otRepository.save(ot);
    }

    private Ot otBuscandoTecnico(ClienteId clienteId) {
        Ot ot = Ot.crear(clienteId, CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                UBICACION_SERVICIO, Instant.now());
        ot.iniciarBusqueda(10.0, Instant.now().plusSeconds(3600), ActorOt.CLIENTE, Instant.now());
        return otRepository.save(ot);
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private record Fixture(Long clienteUsuario, ClienteId clienteId, Long tecnicoUsuario,
            TecnicoId tecnicoId) {
    }
}
