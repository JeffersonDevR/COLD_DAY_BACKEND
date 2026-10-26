package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataOfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataRequerimientoInsumoRepository;
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
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * HTTP proof of the "repuestos a posteriori" surface on the OT resource
 * (roadmap 2.4, task T1): the assigned technician POSTs parts lines at
 * {@code /api/ot/{id}/insumos} and the broadcast machinery is reused. Every
 * guard (role, bound technician, allowed OT state, empty lines) resolves to
 * its canonical status and nothing is written on a failure.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.maps.enabled=false")
class OtInsumosIT {

    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired ProveedorRepository proveedorRepository;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimiento;
    @Autowired SpringDataOfertaInsumoRepository springDataOferta;
    @Autowired SpringDataProveedorRepository springDataProveedor;
    @Autowired JwtTokenIssuer tokenIssuer;

    @org.junit.jupiter.api.BeforeEach
    @org.junit.jupiter.api.AfterEach
    void cleanup() {
        springDataOferta.deleteAll();
        springDataRequerimiento.deleteAll();
        springDataProveedor.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    // ------------------------------------------------------------------
    // POST /api/ot/{id}/insumos (T1)
    // ------------------------------------------------------------------

    @Test
    void theAssignedTechnicianRaisesPartsRequestsAndEachCallCreatesOne() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-insumos-ot@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-insumos-ot@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        crearProveedorActivo("900-OT", "prov.ot@example.com");
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_REPARACION);

        String payload = "{\"observaciones\":\"Repuestos revisados en sitio\","
                + "\"insumos\":[{\"descripcion\":\"Compresor universal 1/3HP\",\"cantidad\":1},"
                + "{\"descripcion\":\"Bimetalico universal L55\",\"cantidad\":2}]}";

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("SOLICITADO"))
                .andExpect(jsonPath("$.otId").value(ot.getId().valor().toString()))
                .andExpect(jsonPath("$.observaciones").value("Repuestos revisados en sitio"))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].descripcion").value("Compresor universal 1/3HP"))
                .andExpect(jsonPath("$.items[1].cantidad").value(2));

        // No single-request invariant: a second accepted call creates a second
        // row with its own broadcast, which is also the SIN_PROVEEDOR retry.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content(
                                "{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isCreated());

        assertThat(springDataRequerimiento.findByOtId(ot.getId().valor())).hasSize(2);
        assertThat(springDataOferta.findAll()).hasSize(2);
    }

    @Test
    void withNoActiveSuppliersTheRequestResolvesToSinProveedorAndRemainsRetriable() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-sin-prov@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-sin-prov@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_REPARACION);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("SIN_PROVEEDOR"))
                .andExpect(jsonPath("$.resueltaEn").isNotEmpty());

        // The documented retriable branch: the retry also returns 201 with a
        // new SIN_PROVEEDOR row, without ever blocking the OT lifecycle.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("SIN_PROVEEDOR"));

        assertThat(springDataRequerimiento.findByOtId(ot.getId().valor())).hasSize(2).allSatisfy(
                row -> assertThat(row.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR));
        assertThat(springDataOferta.findAll()).isEmpty();
    }

    @Test
    void aNonAssignedTechnicianIsForbiddenAndNothingIsCreated() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-intruso-ins@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long duenoUsuario = crearUsuario("tecnico-dueno-ins@example.com", Rol.TECNICO);
        TecnicoId dueno = crearTecnico(duenoUsuario, true);
        Long intrusoUsuario = crearUsuario("tecnico-intruso-ins@example.com", Rol.TECNICO);
        crearTecnico(intrusoUsuario, false);
        Ot ot = otEnEstado(cliente.getId(), dueno, EstadoOt.EN_REPARACION);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        assertThat(springDataRequerimiento.findByOtId(ot.getId().valor())).isEmpty();
    }

    @Test
    void aTerminalOrNotYetBoundOtYieldsTheCanonicalErrorStatus() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-estados@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-estados@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot finalizada = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);
        Ot cancelada = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.CANCELADA);
        // A real not-yet-dispatched OT carries no assigned technician at all.
        Ot sinAsignar = otEnEstado(cliente.getId(), null, EstadoOt.BUSCANDO_TECNICO);

        String payload = "{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}";

        mockMvc.perform(post("/api/ot/" + finalizada.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        mockMvc.perform(post("/api/ot/" + cancelada.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // Not bound yet: the technician ownership guard fires first (403).
        mockMvc.perform(post("/api/ot/" + sinAsignar.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        assertThat(springDataRequerimiento.findAll()).isEmpty();
    }

    @Test
    void anEmptyDeclarationsListAndABlankDescriptionAreCanonical400s() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-vacio@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-vacio@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_REPARACION);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"observaciones\":\"sin lineas\",\"insumos\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"   \",\"cantidad\":1}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(springDataRequerimiento.findAll()).isEmpty();
    }

    @Test
    void anUnknownOtIsNotFoundAndUnauthenticatedCallsAreRejected() throws Exception {
        Long tecnicoUsuario = crearUsuario("tecnico-desconocida@example.com", Rol.TECNICO);
        crearTecnico(tecnicoUsuario, true);

        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/insumos")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));

        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/insumos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"insumos\":[{\"descripcion\":\"Filtro secadora\",\"cantidad\":2}]}"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // Shared fixtures
    // ------------------------------------------------------------------

    private void crearProveedorActivo(String nit, String correo) {
        Long usuarioId = crearUsuario(correo, Rol.PROVEEDOR);
        proveedorRepository.save(Proveedor.crear(usuarioId, "Suministros " + nit, nit, "3105550001", null, null,
                Set.of()));
    }

    private Ot otEnEstado(ClienteId clienteId, TecnicoId tecnicoId, EstadoOt estado) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(), null, null,
                null, null, null, null);
        return otRepository.save(ot);
    }

    private TecnicoId crearTecnico(Long usuarioId, boolean ocupado) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        if (ocupado) {
            tecnico.aceptarOrden();
        }
        tecnico.actualizarUbicacion(UBICACION_SERVICIO, Instant.now());
        return tecnicoRepository.save(tecnico).getId();
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario(String correo, Rol rol) {
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true,
                new PasswordEncoderPort() {
                    public String encode(String p) { return "fake:" + p; }

                    public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
                });
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
