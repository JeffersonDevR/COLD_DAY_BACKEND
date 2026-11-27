package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;
import com.sena.cold_day.support.FkFixtures;

/**
 * Una fila por ruta compartida: qué roles pasan la autorización. "Permitido"
 * significa que la respuesta no es 401 ni 403 (los ids no existen, así que lo
 * normal es 404 o 400); "negado" es 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RolesInternosPermisosIT {

    private static final Rol[] A = { Rol.ADMINISTRADOR };
    private static final Rol[] AC = { Rol.ADMINISTRADOR, Rol.CONTABLE };
    private static final Rol[] AR = { Rol.ADMINISTRADOR, Rol.RECURSOS_HUMANOS };
    private static final Rol[] ACR = { Rol.ADMINISTRADOR, Rol.CONTABLE, Rol.RECURSOS_HUMANOS };
    private static final List<Rol> ROLES =
            List.of(Rol.ADMINISTRADOR, Rol.CONTABLE, Rol.RECURSOS_HUMANOS, Rol.CLIENTE);
    private static final String ID = "00000000-0000-0000-0000-000000000001";

    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired SseTicketService tickets;
    @Autowired SseEmitterRegistry emitters;
    @Autowired OtRepository ots;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired JdbcTemplate jdbc;

    private FkFixtures fx;

    @AfterEach
    void cleanup() {
        emitters.limpiar();
        if (fx != null) {
            springDataHistorial.deleteAll();
            springDataOt.deleteAll();
            fx.limpiarPadres();
        }
    }

    static Stream<Arguments> rutas() {
        return Stream.of(
                fila("GET", "/api/admin/metricas", AC),
                fila("GET", "/api/admin/ot", AC),
                fila("GET", "/api/admin/liquidaciones", AC),
                fila("GET", "/api/admin/liquidaciones/pendientes", AC),
                fila("POST", "/api/admin/liquidaciones/" + ID + "/aprobar", AC),
                fila("POST", "/api/admin/liquidaciones/" + ID + "/rechazar", AC),
                fila("GET", "/api/admin/disputas", A),
                fila("GET", "/api/admin/disputas/abiertas", A),
                fila("GET", "/api/tecnicos", ACR),
                fila("GET", "/api/tecnicos/" + ID + "/documentos", AR),
                fila("PATCH", "/api/tecnicos/" + ID + "/validacion", AR),
                fila("GET", "/api/proveedores", AR),
                fila("GET", "/api/proveedores/" + ID + "/documentos", AR),
                fila("PATCH", "/api/proveedores/" + ID + "/validacion", AR),
                fila("GET", "/api/proveedores/incumplimientos", A),
                fila("GET", "/api/usuarios", A),
                fila("GET", "/api/tecnicos/" + ID, A));
    }

    private static Arguments fila(String metodo, String ruta, Rol[] permitidos) {
        return Arguments.of(metodo, ruta, Set.copyOf(Arrays.asList(permitidos)));
    }

    @ParameterizedTest(name = "{0} {1}")
    @MethodSource("rutas")
    void cadaRutaAdmiteSoloSusRoles(String metodo, String ruta, Set<Rol> permitidos) throws Exception {
        for (Rol rol : ROLES) {
            int estado = mockMvc.perform(request(HttpMethod.valueOf(metodo), ruta)
                            .header("Authorization", "Bearer " + token(rol))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"accion\":\"APROBAR\",\"motivo\":\"motivo de prueba\"}"))
                    .andReturn().getResponse().getStatus();
            if (permitidos.contains(rol)) {
                assertThat(estado).as("%s %s como %s", metodo, ruta, rol).isNotIn(401, 403);
            } else {
                assertThat(estado).as("%s %s como %s", metodo, ruta, rol).isEqualTo(403);
            }
        }
    }

    /** La lectura de una orden ajena: contable sí, Recursos Humanos y otros clientes no. */
    @ParameterizedTest
    @EnumSource(value = Rol.class, names = { "ADMINISTRADOR", "CONTABLE", "RECURSOS_HUMANOS", "CLIENTE" })
    void soloQuienVeLaOperacionLeeUnaOrdenAjena(Rol rol) throws Exception {
        fx = new FkFixtures(jdbc);
        OtId otId = ots.save(Ot.reconstituir(OtId.nueva(), fx.clienteId(), fx.tecnicoId(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(7.8939, -72.5078), EstadoOt.EN_DIAGNOSTICO, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(),
                null, null, null, null, null, null)).getId();
        int esperado = rol == Rol.ADMINISTRADOR || rol == Rol.CONTABLE ? 200 : 403;
        for (String ruta : List.of("/api/ot/" + otId.valor(), "/api/ot/" + otId.valor() + "/historial")) {
            int estado = mockMvc.perform(request(HttpMethod.GET, ruta)
                            .header("Authorization", "Bearer " + token(rol)))
                    .andReturn().getResponse().getStatus();
            assertThat(estado).as("%s como %s", ruta, rol).isEqualTo(esperado);
        }
    }

    @ParameterizedTest
    @EnumSource(value = Rol.class, names = { "ADMINISTRADOR", "CONTABLE", "RECURSOS_HUMANOS", "CLIENTE" })
    void elStreamDelPanelAdmiteACualquierRolInterno(Rol rol) throws Exception {
        String ticket = tickets.emitir(new AuthenticatedUser(new UsuarioId(900_000L), rol));
        int estado = mockMvc.perform(request(HttpMethod.GET, "/api/admin/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andReturn().getResponse().getStatus();
        assertThat(estado).isEqualTo(rol == Rol.CLIENTE ? 403 : 200);
    }

    private String token(Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(900_000L + rol.ordinal()), rol, 0)
                .valor();
    }
}
