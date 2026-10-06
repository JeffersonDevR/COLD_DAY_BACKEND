package com.sena.cold_day.core.shared.infrastructure.security;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Set;

import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sena.cold_day.core.shared.errors.ApiError;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;

/**
 * Limita los intentos por IP en los cuatro endpoints publicos de
 * autenticacion (registro, login, recuperacion y reset de contrasena), que
 * hoy son {@code permitAll} y sin cupo: {@code /api/usuarios/login} acepta
 * intentos infinitos de adivinar la contrasena.
 * <p>
 * Devuelve {@code 429} con {@code Retry-After} al superar
 * {@code app.rate-limit.auth.max-intentos} dentro de
 * {@code app.rate-limit.auth.ventana-segundos}. No cambia ninguna regla de
 * autorizacion: las rutas siguen siendo publicas, solo se les pone cupo.
 * <p>
 * <b>Clave del bucket = {@code getRemoteAddr()} + ruta.</b> Nunca se lee
 * {@code X-Forwarded-For}: ese header lo controla el cliente y mandarlo
 * falseado saltaria el limite trivialmente. Detras del proxy de Render la IP
 * real la resuelve Tomcat a nivel de contenedor
 * ({@code server.forward-headers-strategy=NATIVE} en
 * {@code application-prod.properties}), de modo que {@code getRemoteAddr()}
 * ya refleja la IP del cliente. En dev/test la estrategia queda en
 * {@code NONE} para que la IP sea la del socket (MockMvc la fija con
 * {@code request.setRemoteAddr(...)}), sin reescrituras sorpresa.
 * <p>
 * El bucket se separa por ruta para que agotar el cupo de {@code /login} no
 * bloquee {@code /recuperar-contrasena}.
 * <p>
 * <b>Memoria acotada.</b> El contador vive en una cache Caffeine con
 * {@code maximumSize} (10 000 claves) y {@code expireAfterWrite} = la
 * ventana. Un {@code ConcurrentHashMap} sin tope creceria sin limite: cada
 * IP nueva (o IP spoofable) dejaria una entrada para siempre y un atacante
 * distribuido agotaria la memoria del proceso. Caffeine es la estructura
 * acotada que Spring Boot ya gestiona (respalda spring-boot-starter-cache),
 * sin agregar administracion manual de expiracion.
 * <p>
 * <b>Registro.</b> Es un {@code @Component} y ademas se inserta en la cadena
 * de Spring Security ({@code addFilterBefore}). El contenedor de servlets
 * auto-registra todo bean {@code Filter}, asi que el filtro podria ejecutarse
 * dos veces por peticion; {@link OncePerRequestFilter} lo evita con su
 * marca en un atributo del request (mismo patron ya usado por
 * {@link JwtAuthenticationFilter} y {@link DevAuthBypassFilter}).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /** Las unicas rutas con cupo: coincidencia exacta de metodo + path. */
    private static final Set<String> RUTAS_LIMITADAS = Set.of(
            "/api/usuarios",
            "/api/usuarios/login",
            "/api/usuarios/recuperar-contrasena",
            "/api/usuarios/reset-contrasena");

    private static final String METODO_LIMITADO = "POST";

    /** Tope duro de claves simultaneas: la memoria nunca crece sin limite. */
    private static final int MAX_CLAVES = 10_000;

    private static final String MENSAJE = "Demasiadas solicitudes. Reintente mas tarde.";

    private final RateLimitProperties props;
    private final Cache<String, Integer> contadores;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(RateLimitProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.contadores = Caffeine.newBuilder()
                .maximumSize(MAX_CLAVES)
                // expireAfterWrite se reinicia con cada intento: mientras la IP
                // siga golpeando la ventana no expira y el contador sigue
                // subiendo; al parar, la clave se evapora en una ventana.
                .expireAfterWrite(Duration.ofSeconds(props.ventanaSegundos()))
                .build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        if (!aplica(request)) {
            chain.doFilter(request, response);
            return;
        }
        String clave = request.getRemoteAddr() + "|" + request.getRequestURI();
        int intentos = contar(clave);
        if (intentos > props.maxIntentos()) {
            responder429(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean aplica(HttpServletRequest request) {
        return props.habilitado()
                && METODO_LIMITADO.equalsIgnoreCase(request.getMethod())
                && RUTAS_LIMITADAS.contains(request.getRequestURI());
    }

    /** Cuenta el intento de forma atomica y devuelve el total acumulado. */
    private int contar(String clave) {
        return contadores.asMap().merge(clave, 1, Integer::sum);
    }

    private void responder429(HttpServletResponse response) throws IOException {
        log.warn("Rate limit alcanzado ({} intentos en {}s): se responde 429.",
                props.maxIntentos(), props.ventanaSegundos());
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(props.ventanaSegundos()));
        response.setContentType("application/json");
        // La capa de seguridad escribe un ARRAY de ApiError (ver
        // SecurityConfig.escribirApiError: List.of(new ApiError(...))), no un
        // objeto. El codebase es inconsistente en esto (los advices de modulo
        // responden objeto), pero aqui se mantiene el shape de seguridad para
        // que 401/403/429 se lean igual (los tests existentes asertan
        // $[0].status).
        response.getWriter().write(objectMapper.writeValueAsString(
                List.of(new ApiError(429, MENSAJE, List.of()))));
    }
}
