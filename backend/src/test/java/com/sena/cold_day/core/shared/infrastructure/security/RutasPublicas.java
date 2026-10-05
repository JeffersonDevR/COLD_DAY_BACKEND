package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The security contract: the ONLY places in the application that may be reached
 * without a JWT.
 * <p>
 * This list is deliberately small and hand-written. It is the single source of
 * truth that {@code EndpointsProtegidosTest} compares against the endpoint
 * mappings the framework actually registered, so a new endpoint is protected by
 * default: adding a controller method without a token makes that test fail until
 * somebody consciously adds it here.
 * <p>
 * A prefix entry covers its whole subtree.
 */
public final class RutasPublicas {

    private RutasPublicas() {
    }

    /** Exact method+path pairs that are intentionally anonymous. */
    public static final List<String> EXACTAS = List.of(
            "POST /api/usuarios",
            "POST /api/usuarios/login",
            "POST /api/usuarios/recuperar-contrasena",
            "POST /api/usuarios/reset-contrasena",
            "POST /api/tecnicos",
            "POST /api/clientes",
            // Supplier self-registration. Exact path, never a prefix: only the
            // creation call is anonymous, while GET /api/proveedores (the roster)
            // and PATCH /api/proveedores/{id}/validacion (the operator decision)
            // stay behind ADMINISTRADOR.
            "POST /api/proveedores");

    /** Prefixes that are intentionally anonymous, subtree included. */
    public static final List<String> PREFIJOS = List.of(
            "/actuator/health",
            "/swagger-ui",
            "/swagger-ui.html",
            "/v3/api-docs");

    /** Key used in the reports and in the failure messages. */
    public static String clave(String metodo, String ruta) {
        return metodo + " " + ruta;
    }

    public static boolean esPublica(String metodo, String ruta) {
        String metodoMayusculas = metodo.toUpperCase(Locale.ROOT);
        String rutaSinBarraFinal = ruta.length() > 1 && ruta.endsWith("/")
                ? ruta.substring(0, ruta.length() - 1)
                : ruta;
        if (EXACTAS.contains(clave(metodoMayusculas, rutaSinBarraFinal))) {
            return true;
        }
        return PREFIJOS.stream().anyMatch(prefijo -> coincideConSubarbol(rutaSinBarraFinal, prefijo));
    }

    /** {@code /actuator/health} must cover {@code /actuator/health/liveness}. */
    private static boolean coincideConSubarbol(String ruta, String prefijo) {
        if (!ruta.startsWith(prefijo)) {
            return false;
        }
        int siguiente = prefijo.length();
        return siguiente == ruta.length() || ruta.charAt(siguiente) == '/';
    }

    /**
     * Turns a registered pattern into a request path that can actually be
     * dispatched, so {@code /api/tecnicos/{id}} becomes a concrete URL. The
     * security filter chain runs before argument resolution, so the substituted
     * value never has to exist: a 401 proves the path was gated, and a 404 or
     * 400 would mean the request was let through.
     */
    public static String rutaSolicitable(String patron) {
        Pattern variable = Pattern.compile("\\{[^}/]+}");
        return variable.matcher(patron).replaceAll("PLACEHOLDER").replaceAll("//+", "/");
    }

    /** Subtree roots, exposed for the failure message. */
    public static Set<String> prefijosPublicos() {
        return Set.copyOf(PREFIJOS);
    }
}
