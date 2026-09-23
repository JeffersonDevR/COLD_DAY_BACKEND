package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * Estimate endpoint (spec tar.R5, tar.S3.1, tar.S5.1): authenticated, read-only,
 * 400 for malformed input and HTTP 200 with explicit {@code null} band/tariff when
 * the distance is out of range. Maps is forced off so the Haversine fallback and
 * {@code tarifaFuente = LINEAL} are deterministic.
 */
@SpringBootTest(properties = "app.maps.enabled=false")
@AutoConfigureMockMvc
class TarifaApiIT {

    private static final String CENTRO = "{\"latitud\":7.8939,\"longitud\":-72.5078}";

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired JwtTokenIssuer tokenIssuer;

    private Long usuarioId;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOt.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void estimaParaUnaUbicacionValidaSinTocarLasOrdenes() throws Exception {
        usuarioId = crearUsuario();
        Cliente cliente = crearCliente(usuarioId);
        Ot ot = persistirOt(cliente);

        long antes = springDataOt.count();

        mockMvc.perform(estimar(CENTRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distanciaKm").value(0.0))
                .andExpect(jsonPath("$.tarifaFuente").value("LINEAL"))
                .andExpect(jsonPath("$.banda").value(0))
                .andExpect(jsonPath("$.tarifa").value(30000))
                .andExpect(jsonPath("$.fueraDeRango").value(false));

        assertThat(springDataOt.count()).isEqualTo(antes).isEqualTo(1);
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.SOLICITADA));
    }

    @Test
    void asignaLaBandaDelTramoAlcanzado() throws Exception {
        usuarioId = crearUsuario();

        mockMvc.perform(estimar("{\"latitud\":7.9839,\"longitud\":-72.5078}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tarifaFuente").value("LINEAL"))
                .andExpect(jsonPath("$.banda").value(1))
                .andExpect(jsonPath("$.fueraDeRango").value(false))
                .andExpect(jsonPath("$.tarifa").isNumber());
    }

    @Test
    void devuelve200ConNullsExplicitosCuandoEstaFueraDeRango() throws Exception {
        usuarioId = crearUsuario();

        mockMvc.perform(estimar("{\"latitud\":0.0,\"longitud\":0.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fueraDeRango").value(true))
                .andExpect(jsonPath("$.tarifaFuente").value("LINEAL"))
                .andExpect(jsonPath("$.banda").value(nullValue()))
                .andExpect(jsonPath("$.tarifa").value(nullValue()))
                .andExpect(content().string(containsString("\"banda\":null")))
                .andExpect(content().string(containsString("\"tarifa\":null")));
    }

    @Test
    void rechazaInputMalformadoCon400() throws Exception {
        usuarioId = crearUsuario();

        mockMvc.perform(estimar("{\"latitud\":7.8939}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(estimar("{\"latitud\":100.0,\"longitud\":-72.5078}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rechazaLaEstimacionSinAutenticacion() throws Exception {
        mockMvc.perform(post("/api/ot/tarifa/estimar")
                        .contentType(MediaType.APPLICATION_JSON).content(CENTRO))
                .andExpect(status().isUnauthorized());
    }

    private MockHttpServletRequestBuilder estimar(String body) {
        return post("/api/ot/tarifa/estimar")
                .header("Authorization", "Bearer " + jwt(usuarioId))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private Ot persistirOt(Cliente cliente) {
        Ot ot = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), Instant.parse("2026-09-14T10:00:00Z"));
        return otRepository.save(ot);
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario() {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", "tarifa-" + System.nanoTime() + "@example.com", "secreto",
                "3001234567", null, Rol.CLIENTE, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), Rol.CLIENTE, 0).valor();
    }
}
