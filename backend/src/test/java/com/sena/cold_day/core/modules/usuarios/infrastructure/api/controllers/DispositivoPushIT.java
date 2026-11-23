package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import tools.jackson.databind.ObjectMapper;

/** Registro y baja del token push: 401, validacion, idempotencia y reasignacion. */
@SpringBootTest
@AutoConfigureMockMvc
class DispositivoPushIT {

    private static final String URL = "/api/usuarios/me/dispositivos";

    @Autowired MockMvc mockMvc;
    @Autowired DispositivoPushRepository dispositivos;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired ObjectMapper objectMapper;

    @Test
    void registrarYDarDeBajaRequierenAutenticacion() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"t\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete(URL).contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"t\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rechazaTokenVacioOPlataformaInvalida() throws Exception {
        long usuarioId = registrarCliente("push-invalido@example.com");

        mockMvc.perform(post(URL).header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(URL).header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"abc\",\"plataforma\":\"PALOMA\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registrarEsIdempotenteYElTokenSeReasignaAOtraCuenta() throws Exception {
        long primero = registrarCliente("push-uno@example.com");
        long segundo = registrarCliente("push-dos@example.com");
        String cuerpo = "{\"token\":\"fcm-token-compartido\",\"plataforma\":\"ANDROID\"}";

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post(URL).header("Authorization", "Bearer " + jwt(primero))
                            .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                    .andExpect(status().isNoContent());
        }
        assertThat(dispositivos.listarPorUsuario(primero, 10)).hasSize(1);

        mockMvc.perform(post(URL).header("Authorization", "Bearer " + jwt(segundo))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isNoContent());
        assertThat(dispositivos.listarPorUsuario(primero, 10)).isEmpty();
        assertThat(dispositivos.listarPorUsuario(segundo, 10)).hasSize(1);
    }

    @Test
    void darDeBajaSoloBorraElTokenPropio() throws Exception {
        long dueno = registrarCliente("push-dueno@example.com");
        long ajeno = registrarCliente("push-ajeno@example.com");
        String cuerpo = "{\"token\":\"fcm-token-propio\",\"plataforma\":\"ANDROID\"}";
        mockMvc.perform(post(URL).header("Authorization", "Bearer " + jwt(dueno))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete(URL).header("Authorization", "Bearer " + jwt(ajeno))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isNoContent());
        assertThat(dispositivos.listarPorUsuario(dueno, 10)).hasSize(1);

        mockMvc.perform(delete(URL).header("Authorization", "Bearer " + jwt(dueno))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isNoContent());
        assertThat(dispositivos.listarPorUsuario(dueno, 10)).isEmpty();
    }

    private long registrarCliente(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"nombre\":\"Ana\",\"correo\":\"%s\",\"password\":\"secreto123\","
                                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private String jwt(long usuarioId) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), Rol.CLIENTE, 0).valor();
    }
}
