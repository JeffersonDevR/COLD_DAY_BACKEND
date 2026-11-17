package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import tools.jackson.databind.ObjectMapper;

/** Autorizacion por rol, duplicado, bandeja limitada y resolucion admin (T4.4). */
@SpringBootTest
@AutoConfigureMockMvc
class SolicitudPerfilIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired ObjectMapper objectMapper;

    @Test
    void crearRequiereAutenticacion() throws Exception {
        mockMvc.perform(post("/api/solicitudes-perfil").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfilDeseado\":\"TECNICO\",\"motivacion\":\"Quiero trabajar\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bandejaYResolucionRequierenRolAdmin() throws Exception {
        long usuarioId = registrarClientePublico("no-admin@example.com");
        String token = jwt(usuarioId, Rol.CLIENTE, 0);

        mockMvc.perform(get("/api/admin/solicitudes-perfil").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/admin/solicitudes-perfil/1/resolver")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"aprobar\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearSolicitudYConsultarBandejaAdmin() throws Exception {
        long usuarioId = registrarClientePublico("solicitante@example.com");
        String solicitante = jwt(usuarioId, Rol.CLIENTE, 0);

        String body = mockMvc.perform(post("/api/solicitudes-perfil")
                        .header("Authorization", "Bearer " + solicitante)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfilDeseado\":\"TECNICO\",\"motivacion\":\"Quiero trabajar\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.perfilDeseado").value("TECNICO"))
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andReturn().getResponse().getContentAsString();
        long solicitudId = objectMapper.readTree(body).get("id").asLong();

        mockMvc.perform(get("/api/admin/solicitudes-perfil").param("pagina", "0").param("tamano", "10")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.ADMINISTRADOR, 0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(solicitudId))
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE"));
    }

    @Test
    void rechazaSolicitudDuplicadaAbierta() throws Exception {
        long usuarioId = registrarClientePublico("duplicado@example.com");
        String token = jwt(usuarioId, Rol.CLIENTE, 0);
        String contenido = "{\"perfilDeseado\":\"TECNICO\",\"motivacion\":\"Quiero trabajar\"}";

        mockMvc.perform(post("/api/solicitudes-perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(contenido))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/solicitudes-perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(contenido))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$").isMap())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void rechazaPerfilIgualAlRolInicial() throws Exception {
        long usuarioId = registrarTecnicoPublico("mismo-perfil@example.com");

        mockMvc.perform(post("/api/solicitudes-perfil")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfilDeseado\":\"TECNICO\",\"motivacion\":\"Ya soy tecnico\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void aprobarAdoptaElPerfilYRotaTokenSinCambiarElRol() throws Exception {
        long usuarioId = registrarClientePublico("aprobar@example.com");
        long solicitudId = crearSolicitud(usuarioId, Rol.CLIENTE, Rol.TECNICO);

        mockMvc.perform(patch("/api/admin/solicitudes-perfil/" + solicitudId + "/resolver")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.ADMINISTRADOR, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"aprobar\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("APROBADA"))
                .andExpect(jsonPath("$.resueltaEn").isNotEmpty());

        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isPresent();
        assertThat(usuarioRepository.findByCorreo("aprobar@example.com").orElseThrow().getRol())
                .isEqualTo(Rol.CLIENTE);
        assertThat(usuarioRepository.findByCorreo("aprobar@example.com").orElseThrow().getTokenVersion())
                .isEqualTo(1);
    }

    @Test
    void rechazarNoAdoptaPerfilNiRotaToken() throws Exception {
        long usuarioId = registrarClientePublico("rechazar@example.com");
        long solicitudId = crearSolicitud(usuarioId, Rol.CLIENTE, Rol.TECNICO);

        mockMvc.perform(patch("/api/admin/solicitudes-perfil/" + solicitudId + "/resolver")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.ADMINISTRADOR, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"aprobar\":false,\"motivoRechazo\":\"Faltan documentos\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("RECHAZADA"))
                .andExpect(jsonPath("$.motivoRechazo").value("Faltan documentos"));

        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isEmpty();
        assertThat(usuarioRepository.findByCorreo("rechazar@example.com").orElseThrow().getTokenVersion())
                .isZero();
    }

    @Test
    void noSePuedeResolverDosVeces() throws Exception {
        long usuarioId = registrarClientePublico("dos-veces@example.com");
        long solicitudId = crearSolicitud(usuarioId, Rol.CLIENTE, Rol.TECNICO);
        String admin = jwt(usuarioId, Rol.ADMINISTRADOR, 0);

        mockMvc.perform(patch("/api/admin/solicitudes-perfil/" + solicitudId + "/resolver")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"aprobar\":false}"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/admin/solicitudes-perfil/" + solicitudId + "/resolver")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"aprobar\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    private long crearSolicitud(long usuarioId, Rol rolSolicitante, Rol deseado) throws Exception {
        String body = mockMvc.perform(post("/api/solicitudes-perfil")
                        .header("Authorization", "Bearer " + jwt(usuarioId, rolSolicitante, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"perfilDeseado\":\"%s\",\"motivacion\":\"Quiero trabajar\"}").formatted(deseado)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private long registrarClientePublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"nombre\":\"Ana\",\"correo\":\"%s\",\"password\":\"secreto123\","
                                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private long registrarTecnicoPublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"numeroIdentificacion\":\"P-1\",\"nombre\":\"Ana\",\"correo\":\"%s\","
                                + "\"password\":\"secreto123\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private String jwt(long usuarioId, Rol rol, int tokenVersion) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, tokenVersion).valor();
    }
}
