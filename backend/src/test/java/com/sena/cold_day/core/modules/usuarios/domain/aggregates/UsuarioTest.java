package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.HabeasDataRequeridoException;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Domain unit test with a fake PasswordEncoderPort — no Spring, no BCrypt. */
class UsuarioTest {

    private final PasswordEncoderPort fakeEncoder = new PasswordEncoderPort() {
        @Override
        public String encode(String passwordPlano) {
            return "fake:" + passwordPlano;
        }

        @Override
        public boolean matches(String passwordPlano, String hashAlmacenado) {
            return ("fake:" + passwordPlano).equals(hashAlmacenado);
        }
    };

    @Test
    void registrarHashesThePasswordAndRejectsInvalidDatos() {
        Usuario usuario = Usuario.registrar("Ana", "ana@example.com", "secreto", "3001234567", null,
                Rol.TECNICO, true, fakeEncoder);

        assertThat(usuario.getCorreo()).isEqualTo("ana@example.com");
        assertThat(usuario.getRol()).isEqualTo(Rol.TECNICO);
        assertThat(usuario.isHabeasDataAceptado()).isTrue();
        assertThat(usuario.getPasswordHash()).isEqualTo("fake:secreto");

        assertThatThrownBy(() -> Usuario.registrar("Ana", "correo-sin-arroba", "x", null, null,
                Rol.CLIENTE, true, fakeEncoder)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Usuario.registrar("Ana", "ana@example.com", "x", null, null, null,
                true, fakeEncoder)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void registrarRequiresHabeasDataConsent() {
        assertThatThrownBy(() -> Usuario.registrar("Ana", "ana@example.com", "secreto", null, null,
                Rol.CLIENTE, false, fakeEncoder))
                .isInstanceOf(HabeasDataRequeridoException.class);
    }

    @Test
    void registrarPersistsConsentAtomicallyForEveryRole() {
        Usuario cliente = Usuario.registrar("Ana", "ana@example.com", "secreto", null, null,
                Rol.CLIENTE, true, fakeEncoder);
        Usuario tecnico = Usuario.registrar("Luis", "luis@example.com", "secreto", null, null,
                Rol.TECNICO, true, fakeEncoder);

        assertThat(cliente.isHabeasDataAceptado()).isTrue();
        assertThat(tecnico.isHabeasDataAceptado()).isTrue();
        assertThat(cliente.getPasswordHash()).isEqualTo("fake:secreto");
        assertThat(tecnico.getPasswordHash()).isEqualTo("fake:secreto");
    }

    @Test
    void verificarCredencialesAcceptsValidAndRejectsWrong() {
        Usuario usuario = Usuario.registrar("Ana", "ana@example.com", "secreto", null, null,
                Rol.CLIENTE, true, fakeEncoder);

        usuario.verificarCredenciales("secreto", fakeEncoder);

        assertThatThrownBy(() -> usuario.verificarCredenciales("otro", fakeEncoder))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    @Test
    void registrarWithConsentThenUpdatePerfil() {
        Usuario usuario = Usuario.registrar("Ana", "ana@example.com", "secreto", null, null,
                Rol.CONTABLE, true, fakeEncoder);

        usuario.actualizarPerfil("Ana Maria", "3100000000", "http://foto");

        assertThat(usuario.isHabeasDataAceptado()).isTrue();
        assertThat(usuario.getNombre()).isEqualTo("Ana Maria");
        assertThat(usuario.getTelefono()).isEqualTo("3100000000");
        assertThat(usuario.getFechaRegistro()).isBefore(LocalDateTime.now().plusMinutes(1));
    }

    @Test
    void reconstituirKeepsPersistedState() {
        LocalDateTime fecha = LocalDateTime.of(2026, 1, 1, 10, 0);
        Usuario usuario = Usuario.reconstituir(5L, "Ana", "ana@example.com", "fake:hash", "300", null,
                Rol.ADMINISTRADOR, fecha, true, true);

        assertThat(usuario.getId()).isEqualTo(5L);
        assertThat(usuario.getUsuarioId()).isEqualTo(new UsuarioId(5L));
        assertThat(usuario.getRol()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(usuario.getFechaRegistro()).isEqualTo(fecha);
        assertThat(usuario.isHabeasDataAceptado()).isTrue();
        usuario.recuperarContrasena();
    }
}
