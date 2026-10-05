package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
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
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * The signed warranty acta (POST /api/ot/{id}/acta, V11).
 *
 * <p>This is the endpoint that replaces a fake. The payment page used to toast
 * "Acta Generada" and print a verification code it fabricated from the order
 * id, while the signature drawn on the canvas was thrown away. Under Ley 1480
 * that document is the consumer's proof of 90 days of warranty, so the tests
 * here assert what is actually STORED, not only what the response says, and
 * they pin the two properties the fabrication violated: the code is issued by
 * the server (never derivable from the order id) and signing is the client's
 * exclusive act on their own FINALIZADA order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.dispatch.escalamiento-ms=3600000",
        "app.maps.enabled=false",
})
class ActaGarantiaApiIT {

    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);
    private static final String FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    // ------------------------------------------------- persistencia real (V11)

    @Test
    void theOwningClientSignsTheActaOnAFinalizedOrderAndItSurvivesARoundTrip() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-acta@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.otId").value(ot.getId().valor().toString()))
                .andExpect(jsonPath("$.codigoVerificacion").isNotEmpty())
                .andExpect(jsonPath("$.firmadaEn").isNotEmpty());

        // The point of the whole change: the ink and the seal are in the
        // database, not just in the HTTP response the toast was built from.
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getActaFirmaDataUrl()).isEqualTo(FIRMA);
                    assertThat(found.getActaCodigoVerificacion()).isNotNull();
                    assertThat(found.getActaCodigoVerificacion().valor())
                            .startsWith("CD-ACT-")
                            .hasSize("CD-ACT-".length() + 16);
                    assertThat(found.getActaFirmadaEn()).isNotNull();
                    assertThat(found.actaFirmada()).isTrue();
                });

        // Reading the OT back over REST carries the acta state (not the ~1 MB
        // of ink), so the page can tell a signed acta from an unsigned one.
        mockMvc.perform(get("/api/ot/" + ot.getId().valor())
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actaFirmada").value(true))
                .andExpect(jsonPath("$.actaCodigoVerificacion").value(startsWith("CD-ACT-")));
    }

    /**
     * The response must describe what was stored, not what was requested: the
     * code in the payload equals the code on the aggregate after the reload.
     */
    @Test
    void theCodeInTheResponseIsTheCodeThatWasPersisted() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-codigo@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);

        String cuerpo = mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String codigo = JsonPath.read(cuerpo, "$.codigoVerificacion");
        assertThat(codigo).isNotNull();
        assertThat(otRepository.buscarPorId(ot.getId()).orElseThrow().getActaCodigoVerificacion().valor())
                .isEqualTo(codigo);
    }

    // ------------------------------------------ el codigo NO viene del id

    @Test
    void theVerificationCodeIsNotDerivedFromTheOrderId() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-id@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);

        String codigo = leerCodigo(ot, clienteUsuario);

        // This is exactly the string the old template printed. If the server
        // ever regressed to deriving it from the id, this assertion fires.
        assertThat(codigo).isNotEqualTo("CD-SEC-" + ot.getId().valor());
        assertThat(codigo).doesNotContain(ot.getId().valor().toString());
    }

    @Test
    void twoSignedActasProduceDifferentCodes() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-unicidad@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot primera = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);
        Ot segunda = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);

        // Same client, same shape of order, seconds apart: only the CSPRNG
        // keeps these apart. A time- or id-derived code would collide.
        String codigoPrimero = leerCodigo(primera, clienteUsuario);
        String codigoSegundo = leerCodigo(segunda, clienteUsuario);

        assertThat(codigoPrimero).isNotEqualTo(codigoSegundo);
        assertThat(otRepository.buscarPorId(primera.getId()).orElseThrow().getActaCodigoVerificacion().valor())
                .isEqualTo(codigoPrimero);
        assertThat(otRepository.buscarPorId(segunda.getId()).orElseThrow().getActaCodigoVerificacion().valor())
                .isEqualTo(codigoSegundo);
    }

    // ------------------------------------- precondicion de dominio -> 409

    @Test
    void signingOnAnOrderThatIsNotFinalizedIsAConflict() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-estado@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.EN_CAMINO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // Nothing was written: no half-signed acta to confuse the client later.
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getActaFirmaDataUrl()).isNull();
                    assertThat(found.getActaCodigoVerificacion()).isNull();
                    assertThat(found.getActaFirmadaEn()).isNull();
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
                });
    }

    @Test
    void signingTwiceIsAConflictAndKeepsTheOriginalActa() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-doble@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);
        String token = jwt(clienteUsuario, Rol.CLIENTE);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isOk());
        String codigoOriginal = otRepository.buscarPorId(ot.getId()).orElseThrow()
                .getActaCodigoVerificacion().valor();

        // Re-signing would replace the document the client is already holding
        // and invalidate the code printed on it.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma("data:image/png;base64,b3Ryb3I=")))
                .andExpect(status().isConflict());

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getActaFirmaDataUrl()).isEqualTo(FIRMA);
                    assertThat(found.getActaCodigoVerificacion().valor()).isEqualTo(codigoOriginal);
                });
    }

    // ------------------------------------------------- la firma es del cliente

    @Test
    void aTechnicianCannotSignTheActaOfTheirOwnWork() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-tec@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-acta-firma@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);

        // The acta is the consumer's own declaration of conformity; the party
        // that performed the work must not sign (nor countersign) it.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getActaFirmadaEn()).isNull());
    }

    @Test
    void aClientWhoDoesNotOwnTheOrderCannotSignItsActa() throws Exception {
        Long duenoUsuario = crearUsuario("cliente-acta-dueno@example.com", Rol.CLIENTE);
        Cliente dueno = crearCliente(duenoUsuario);
        Long intrusoUsuario = crearUsuario("cliente-acta-intruso@example.com", Rol.CLIENTE);
        crearCliente(intrusoUsuario);
        Ot ot = otEnEstado(dueno.getId(), null, EstadoOt.FINALIZADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getActaFirmadaEn()).isNull());
    }

    @Test
    void rejectsUnauthenticatedActaSigning() throws Exception {
        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/acta")
                        .contentType(MediaType.APPLICATION_JSON).content(jsonFirma(FIRMA)))
                .andExpect(status().isUnauthorized());
    }

    // --------------------------------------------- validacion de la firma

    @Test
    void aBlankSignatureIsABadRequest() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-vacia@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);

        // @NotBlank on FirmarActaApiRequest: the drawing may exist on the
        // canvas while exporting to a data URL yields nothing usable.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firmaDataUrl\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getActaFirmadaEn()).isNull());
    }

    @Test
    void anOversizedSignatureIsABadRequest() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-acta-grande@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.FINALIZADA);
        String enorme = "data:image/png;base64," + "A".repeat(Ot.MAX_FIRMA_ACTA_CHARS);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(enorme)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getActaFirmaDataUrl()).isNull();
                    assertThat(found.getActaFirmadaEn()).isNull();
                });
    }

    // ------------------------------------------------------------------ helpers

    private String leerCodigo(Ot ot, Long clienteUsuario) throws Exception {
        String cuerpo = mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/acta")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonFirma(FIRMA)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(cuerpo, "$.codigoVerificacion");
    }

    /** Serializes the data URL without hand-escaping: it is base64, so it has nothing to escape. */
    private String jsonFirma(String firmaDataUrl) {
        return "{\"firmaDataUrl\":\"" + firmaDataUrl + "\"}";
    }

    private Ot otEnEstado(ClienteId clienteId, TecnicoId tecnicoId, EstadoOt estado) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(), null, null, null, null, null,
                null);
        return otRepository.save(ot);
    }

    private TecnicoId crearTecnico(Long usuarioId) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.actualizarUbicacion(UBICACION_SERVICIO, Instant.now());
        return tecnicoRepository.save(tecnico).getId();
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
