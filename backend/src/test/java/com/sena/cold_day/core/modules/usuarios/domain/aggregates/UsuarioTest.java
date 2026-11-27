package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.HabeasDataRequeridoException;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.exception.RolNoGestionableException;
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
        assertThat(usuario.getFechaRegistro()).isBefore(Instant.now().plusSeconds(60));
    }

    @Test
    void unaCuentaInternaNaceActivaYSinConsentimientoAjeno() {
        Usuario cuenta = Usuario.crearCuentaInterna("Laura", "laura@example.com", Rol.RECURSOS_HUMANOS,
                "aleatoria", fakeEncoder);

        assertThat(cuenta.isActivo()).isTrue();
        assertThat(cuenta.isHabeasDataAceptado()).isFalse();
        assertThat(cuenta.getTelefono()).isNull();
        assertThat(cuenta.getRol()).isEqualTo(Rol.RECURSOS_HUMANOS);
    }

    @Test
    void noSePuedeCrearUnAdministradorNiUnRolDeLaAppComoCuentaInterna() {
        for (Rol rol : new Rol[] { Rol.ADMINISTRADOR, Rol.CLIENTE, Rol.TECNICO, Rol.PROVEEDOR }) {
            assertThatThrownBy(() -> Usuario.crearCuentaInterna("X", "x@example.com", rol, "aleatoria",
                    fakeEncoder)).isInstanceOf(RolNoGestionableException.class);
        }
    }

    @Test
    void unaCuentaDesactivadaSePuedeReactivar() {
        Usuario cuenta = Usuario.crearCuentaInterna("Ana", "ana@example.com", Rol.CONTABLE, "aleatoria",
                fakeEncoder);

        cuenta.desactivar();
        assertThat(cuenta.isActivo()).isFalse();
        cuenta.reactivar();
        assertThat(cuenta.isActivo()).isTrue();
    }

    @Test
    void reconstituirKeepsPersistedState() {
        Instant fecha = Instant.parse("2026-01-01T10:00:00Z");
        Usuario usuario = Usuario.reconstituir(5L, "Ana", "ana@example.com", "fake:hash", "300", null,
                Rol.ADMINISTRADOR, fecha, true, true, 4);

        assertThat(usuario.getId()).isEqualTo(5L);
        assertThat(usuario.getUsuarioId()).isEqualTo(new UsuarioId(5L));
        assertThat(usuario.getRol()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(usuario.getFechaRegistro()).isEqualTo(fecha);
        assertThat(usuario.isHabeasDataAceptado()).isTrue();
        assertThat(usuario.getTokenVersion()).isEqualTo(4);
        usuario.recuperarContrasena();
    }

    @Test
    void tokenVersionStartsAtZeroAndBumpsMonotonically() {
        Usuario usuario = Usuario.registrar("Ana", "ana@example.com", "secreto", null, null,
                Rol.CLIENTE, true, fakeEncoder);

        assertThat(usuario.getTokenVersion()).isZero();
        assertThat(usuario.incrementarTokenVersion()).isEqualTo(1);
        assertThat(usuario.incrementarTokenVersion()).isEqualTo(2);
        assertThat(usuario.getTokenVersion()).isEqualTo(2);
    }
}
