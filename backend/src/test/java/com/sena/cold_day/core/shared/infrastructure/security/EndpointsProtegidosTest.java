package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * The security contract, derived from the framework instead of a hand-written
 * list of endpoints.
 * <p>
 * Every {@code @RequestMapping} the application actually registered is read
 * from {@link RequestMappingHandlerMapping} and probed with an anonymous
 * request. An endpoint passes only when it is either explicitly listed in
 * {@link RutasPublicas} or answers 401. Adding a controller method is therefore
 * secure by default: the new endpoint fails this test until someone decides it
 * is public and records that decision in one visible place.
 * <p>
 * The build disables the dev bypass for tests
 * ({@code app.security.dev-bypass.enabled=false}), so an anonymous request here
 * really is anonymous.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class EndpointsProtegidosTest {

    @Autowired MockMvc mockMvc;
    @Autowired ApplicationContext context;

    /**
     * Resolved by bean name, not by type: springdoc contributes additional
     * {@code HandlerMapping} beans, so a by-type lookup is ambiguous. This is the
     * framework's own MVC mapping bean — the endpoint list stays derived, never
     * hand-written.
     */
    private RequestMappingHandlerMapping handlerMapping() {
        return context.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class);
    }

    @TestFactory
    @DisplayName("todo endpoint fuera de la lista publica responde 401 sin token")
    List<DynamicTest> todoEndpointNoRegistradoEstaAbierto() {
        List<String[]> combinaciones = new ArrayList<>();
        List<RequestMappingInfo> mapeos = new ArrayList<>(handlerMapping().getHandlerMethods().keySet());
        // Deterministic order so a failure is reproducible.
        mapeos.sort((a, b) -> a.toString().compareTo(b.toString()));

        for (RequestMappingInfo info : mapeos) {
            if (info.getPathPatternsCondition() == null) {
                continue;
            }
            for (RequestMethod metodo
                    : info.getMethodsCondition().getMethods()) {
                for (String patron : info.getPathPatternsCondition().getPatternValues()) {
                    combinaciones.add(new String[] { metodo.name(), patron });
                }
            }
        }

        assertThat(combinaciones).as("el framework debe tener endpoints registrados").isNotEmpty();

        return combinaciones.stream()
                .map(metodoYRuta -> DynamicTest.dynamicTest(
                        metodoYRuta[0] + " " + metodoYRuta[1],
                        () -> comprobarAnonimo(metodoYRuta[0], metodoYRuta[1])))
                .toList();
    }

    private void comprobarAnonimo(String metodo, String patron) throws Exception {
        if (RutasPublicas.esPublica(metodo, patron)) {
            return; // Explicitly public: covered by the allowlist, nothing to prove.
        }
        String ruta = RutasPublicas.rutaSolicitable(patron);
        int status = mockMvc.perform(request(HttpMethod.valueOf(metodo), ruta))
                .andReturn().getResponse().getStatus();
        assertThat(status)
                .as("%s %s no esta en la lista publica y debe responder 401 sin token (respondio %d)",
                        metodo, patron, status)
                .isEqualTo(401);
    }

    /** Sanity check on the allowlist itself: it must not rot into a wildcard. */
    @TestFactory
    @DisplayName("la lista publica no admite comodines que abririan endpoints futuros")
    List<DynamicTest> laListaPublicaNoSeAmpliaPorError() {
        return RutasPublicas.EXACTAS.stream()
                .map(entrada -> DynamicTest.dynamicTest(entrada, () -> {
                    assertThat(entrada).doesNotContain("*");
                    assertThat(entrada).contains("/");
                    String[] partes = entrada.split(" ", 2);
                    assertThat(RutasPublicas.esPublica(partes[0], partes[1]))
                            .as("%s debe estar en la lista publica", entrada)
                            .isTrue();
                }))
                .toList();
    }

    /** Documents what the contract actually covers, so a silent shrink is visible. */
    @Test
    @DisplayName("el contrato cubre una superficie de endpoints no trivial")
    void laSuperficieDescubiertaNoEsTrivial() {
        Set<String> rutas = new TreeSet<>();
        handlerMapping().getHandlerMethods().keySet().forEach(info -> {
            if (info.getPathPatternsCondition() != null) {
                info.getPathPatternsCondition().getPatternValues()
                        .forEach(patron -> info.getMethodsCondition().getMethods()
                                .forEach(m -> rutas.add(m.name() + " " + patron.toLowerCase(Locale.ROOT))));
            }
        });
        assertThat(rutas)
                .as("si esto baja, el test esta dejando de cubrir endpoints reales")
                .hasSizeGreaterThan(40);
    }
}
