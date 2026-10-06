package com.sena.cold_day.core.shared.errors;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

import com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers.ClienteControllerAdvice;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers.ProveedorControllerAdvice;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers.TecnicoControllerAdvice;

/**
 * Regression guard for the advice ordering invariant of the hardening feature.
 *
 * <p>Spring defaults a {@code @RestControllerAdvice} without {@code @Order} to
 * {@link Ordered#LOWEST_PRECEDENCE}, which ties with {@link GlobalControllerAdvice}.
 * Since equal order is documented as arbitrary, that tie can silently let the
 * generic global {@code DataIntegrityViolationException} message replace the
 * module-specific one. The invariant proved here, directly from the annotations
 * (no Spring context, no Docker), is that every module advice that maps the same
 * exception declares an order strictly lower than the global fallback.
 */
class AdvicePrecedenceTest {

    private static final List<Class<?>> MODULE_ADVICES = List.of(
            ClienteControllerAdvice.class,
            ProveedorControllerAdvice.class,
            TecnicoControllerAdvice.class);

    @Test
    void globalFallbackExplicitlyDeclaresLowestPrecedence() {
        Order order = AnnotationUtils.findAnnotation(GlobalControllerAdvice.class, Order.class);

        assertThat(order)
                .as("GlobalControllerAdvice must declare @Order explicitly, not rely on the default")
                .isNotNull();
        assertThat(order.value())
                .as("GlobalControllerAdvice must be the last advice to respond")
                .isEqualTo(Ordered.LOWEST_PRECEDENCE);
    }

    @Test
    void moduleAdvicesWinOverTheGlobalFallback() {
        int global = declaredOrder(GlobalControllerAdvice.class);

        for (Class<?> advice : MODULE_ADVICES) {
            assertThat(declaredOrder(advice))
                    .as("%s must be ordered strictly before GlobalControllerAdvice",
                            advice.getSimpleName())
                    .isLessThan(global);
        }
    }

    private static int declaredOrder(Class<?> advice) {
        Order order = AnnotationUtils.findAnnotation(advice, Order.class);
        assertThat(order)
                .as("%s must declare @Order explicitly", advice.getSimpleName())
                .isNotNull();
        return order.value();
    }
}
