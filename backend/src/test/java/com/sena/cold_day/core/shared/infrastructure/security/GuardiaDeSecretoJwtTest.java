package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/**
 * El literal publicado en {@code .env.example} no puede valer fuera de dev.
 * Tres casos: dev lo tolera (es el default local), prod lo rechaza, y prod con
 * un secreto real arranca.
 */
class GuardiaDeSecretoJwtTest {

    private static final String REAL = "0123456789abcdef0123456789abcdef-real";

    private MockEnvironment entorno(String... perfiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(perfiles);
        return environment;
    }

    @Test
    void devToleraElSecretoDeDesarrollo() {
        JwtProperties props = new JwtProperties(JwtProperties.DEV_DEFAULT_SECRET, 3_600_000);

        assertThatCode(() -> new GuardiaDeSecretoJwt(props, entorno("dev")))
                .doesNotThrowAnyException();
    }

    @Test
    void prodRechazaElSecretoDeDesarrollo() {
        JwtProperties props = new JwtProperties(JwtProperties.DEV_DEFAULT_SECRET, 3_600_000);

        assertThatThrownBy(() -> new GuardiaDeSecretoJwt(props, entorno("prod")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("valor de desarrollo");
    }

    @Test
    void sinPerfilRechazaElSecretoDeDesarrollo() {
        JwtProperties props = new JwtProperties(JwtProperties.DEV_DEFAULT_SECRET, 3_600_000);

        assertThatThrownBy(() -> new GuardiaDeSecretoJwt(props, entorno()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodAceptaUnSecretoReal() {
        JwtProperties props = new JwtProperties(REAL, 3_600_000);

        assertThatCode(() -> new GuardiaDeSecretoJwt(props, entorno("prod")))
                .doesNotThrowAnyException();
    }
}
