package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/**
 * Boundary test for the supplier validation payload. {@code accion} is the
 * business-required selector: without {@code @NotBlank} a missing value was
 * silently read as "not APROBAR" (a rejection), so it must be rejected at the
 * boundary instead. Pure unit test, no Spring.
 */
class ValidacionProveedorApiRequestTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void accionIsRequired() {
        assertThat(camposInvalidos(new ValidacionProveedorApiRequest(null, null))).contains("accion");
        assertThat(camposInvalidos(new ValidacionProveedorApiRequest("   ", null))).contains("accion");
        assertThat(camposInvalidos(new ValidacionProveedorApiRequest("APROBAR", null))).isEmpty();
    }

    @Test
    void motivoIsTrimmedButOptional() {
        assertThat(new ValidacionProveedorApiRequest("RECHAZAR", "  falta   soporte  ").motivo())
                .isEqualTo("falta soporte");
        assertThat(new ValidacionProveedorApiRequest("RECHAZAR", null).motivo()).isNull();
    }

    private static Set<String> camposInvalidos(ValidacionProveedorApiRequest request) {
        return VALIDATOR.validate(request).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(java.util.stream.Collectors.toSet());
    }
}
