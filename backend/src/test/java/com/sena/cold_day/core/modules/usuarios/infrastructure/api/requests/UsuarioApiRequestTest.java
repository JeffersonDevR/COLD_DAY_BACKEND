package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/**
 * Boundary tests for the generic registration payload. Pure unit test: it
 * builds the record directly, so it does not need Spring or a database.
 */
class UsuarioApiRequestTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void normalizesFreeTextWithoutTouchingThePassword() {
        var request = new UsuarioApiRequest(
                "  Ana   Maria  ",
                "  ana@example.com ",
                "  secreto  ",
                "  300  123 4567  ",
                null,
                true);

        assertThat(request.nombre()).isEqualTo("Ana Maria");
        assertThat(request.correo()).isEqualTo("ana@example.com");
        assertThat(request.telefono()).isEqualTo("300 123 4567");
        // The password must stay byte-for-byte intact: normalization is for text, not secrets.
        assertThat(request.password()).isEqualTo("  secreto  ");
    }

    @Test
    void correoIsRequiredNotJustWellFormed() {
        assertThat(camposInvalidos(new UsuarioApiRequest("Ana", null, "secreto", null, null, true)))
                .contains("correo");
        assertThat(camposInvalidos(new UsuarioApiRequest("Ana", "   ", "secreto", null, null, true)))
                .contains("correo");
        assertThat(camposInvalidos(new UsuarioApiRequest("Ana", "no-es-un-correo", "secreto", null, null, true)))
                .contains("correo");
    }

    @Test
    void passwordPolicyRequiresEightTo72Bytes() {
        // Por debajo del minimo y por encima del maximo de BCrypt.
        assertThat(camposInvalidos(new UsuarioApiRequest("Ana", "ana@example.com", "corto12", null, null, true)))
                .contains("password");
        assertThat(camposInvalidos(
                new UsuarioApiRequest("Ana", "ana@example.com", "x".repeat(73), null, null, true)))
                .contains("password");
        // Justo en el borde inferior: valida.
        assertThat(camposInvalidos(new UsuarioApiRequest("Ana", "ana@example.com", "ocho1234", null, null, true)))
                .isEmpty();
    }

    private static Set<String> camposInvalidos(UsuarioApiRequest request) {
        return VALIDATOR.validate(request).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(java.util.stream.Collectors.toSet());
    }
}
