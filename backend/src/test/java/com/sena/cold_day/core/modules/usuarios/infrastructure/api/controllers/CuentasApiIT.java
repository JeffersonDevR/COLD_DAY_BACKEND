package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.CuentaInternaInvitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataTokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

@SpringBootTest
@AutoConfigureMockMvc
class CuentasApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired PasswordEncoderPort encoder;
    @Autowired SpringDataUsuarioRepository usuarios;
    @Autowired SpringDataTokenRecuperacionRepository tokens;
    @MockitoBean NotificadorRecuperacion notificador;

    @AfterEach
    void cleanup() {
        tokens.deleteAll();
        usuarios.deleteAll();
    }

    @Test
    void crearInvitaYLaPersonaPoneSuContrasena() throws Exception {
        crear("Laura", "laura@example.com", "RECURSOS_HUMANOS")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rol").value("RECURSOS_HUMANOS"))
                .andExpect(jsonPath("$.activa").value(true));

        ArgumentCaptor<CuentaInternaInvitada> invitacion = ArgumentCaptor.forClass(CuentaInternaInvitada.class);
        verify(notificador).invitar(invitacion.capture());
        assertThat(invitacion.getValue().correo()).isEqualTo("laura@example.com");

        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + invitacion.getValue().token()
                                + "\",\"nuevaPassword\":\"clave-nueva-1\"}"))
                .andExpect(status().isNoContent());
        entrar("laura@example.com").andExpect(status().isOk());

        Long id = usuarios.findByCorreo("laura@example.com").orElseThrow().getId();
        String sesion = tokenIssuer.emitir(new UsuarioId(id), Rol.RECURSOS_HUMANOS, 1).valor();
        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer " + sesion))
                .andExpect(status().isOk());

        cambiarEstado(id, false).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer " + sesion))
                .andExpect(status().isUnauthorized());
        entrar("laura@example.com").andExpect(status().isUnauthorized());

        cambiarEstado(id, true).andExpect(status().isNoContent());
        entrar("laura@example.com").andExpect(status().isOk());
    }

    @Test
    void desactivarAnulaLaInvitacionPendienteAunqueSeReactive() throws Exception {
        crear("Ana", "ana@example.com", "CONTABLE").andExpect(status().isCreated());
        ArgumentCaptor<CuentaInternaInvitada> invitacion = ArgumentCaptor.forClass(CuentaInternaInvitada.class);
        verify(notificador).invitar(invitacion.capture());
        Long id = usuarios.findByCorreo("ana@example.com").orElseThrow().getId();

        cambiarEstado(id, false).andExpect(status().isNoContent());
        cambiarEstado(id, true).andExpect(status().isNoContent());

        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + invitacion.getValue().token()
                                + "\",\"nuevaPassword\":\"clave-nueva-1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unCorreoYaUsadoDa409() throws Exception {
        crear("Ana", "ana@example.com", "CONTABLE").andExpect(status().isCreated());
        crear("Otra", "ana@example.com", "RECURSOS_HUMANOS").andExpect(status().isConflict());
    }

    @Test
    void noSeCreanAdministradoresDesdeElPanel() throws Exception {
        crear("X", "x@example.com", "ADMINISTRADOR").andExpect(status().isBadRequest());
        assertThat(usuarios.existsByCorreo("x@example.com")).isFalse();
    }

    @Test
    void soloListaYTocaCuentasInternas() throws Exception {
        Long cliente = usuarios.save(UsuarioJpaEntity.fromDomain(Usuario.registrar("Cliente", "cli@example.com",
                "secreto123", "3001234567", null, Rol.CLIENTE, true, encoder))).getId();
        crear("Ana", "ana@example.com", "CONTABLE").andExpect(status().isCreated());

        mockMvc.perform(get("/api/admin/cuentas").header("Authorization", "Bearer " + admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].correo").value("ana@example.com"));
        cambiarEstado(cliente, false).andExpect(status().isNotFound());
    }

    @Test
    void unContableNoAdministraCuentas() throws Exception {
        String contable = tokenIssuer.emitir(new UsuarioId(900_100L), Rol.CONTABLE, 0).valor();
        mockMvc.perform(get("/api/admin/cuentas").header("Authorization", "Bearer " + contable))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/cuentas").header("Authorization", "Bearer " + contable)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Y\",\"correo\":\"y@example.com\",\"rol\":\"CONTABLE\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/admin/cuentas/1/estado").header("Authorization", "Bearer " + contable)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"activa\":false}"))
                .andExpect(status().isForbidden());
    }

    private String admin() {
        return tokenIssuer.emitir(new UsuarioId(900_000L), Rol.ADMINISTRADOR, 0).valor();
    }

    private ResultActions crear(String nombre, String correo, String rol) throws Exception {
        return mockMvc.perform(post("/api/admin/cuentas").header("Authorization", "Bearer " + admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"%s\",\"correo\":\"%s\",\"rol\":\"%s\"}".formatted(nombre, correo, rol)));
    }

    private ResultActions cambiarEstado(Long id, boolean activa) throws Exception {
        return mockMvc.perform(patch("/api/admin/cuentas/" + id + "/estado")
                .header("Authorization", "Bearer " + admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"activa\":" + activa + "}"));
    }

    private ResultActions entrar(String correo) throws Exception {
        return mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"" + correo + "\",\"password\":\"clave-nueva-1\"}"));
    }
}
