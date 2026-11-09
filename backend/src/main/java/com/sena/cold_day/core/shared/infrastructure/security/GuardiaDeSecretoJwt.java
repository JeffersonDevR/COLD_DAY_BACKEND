package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Impide arrancar con el secreto JWT de desarrollo fuera del perfil {@code dev}.
 *
 * <p>{@link JwtProperties} ya rechaza un secreto vacio o de menos de 32 bytes,
 * pero el literal publicado en {@code backend/.env.example} cumple ambas
 * condiciones. Sin este guard, copiar el ejemplo a {@code .env} en produccion
 * deja la API firmando tokens con un secreto que cualquiera puede leer en el
 * repo: con el, se forja un HS256 con {@code sub} de un administrador y el
 * filtro lo acepta, porque solo verifica firma y version.
 *
 * <p>{@link JwtProperties#DEV_DEFAULT_SECRET} existia declarado para esto y no se
 * usaba en ningun sitio; aca se le da su unico proposito.
 */
@Component
public class GuardiaDeSecretoJwt {

    public GuardiaDeSecretoJwt(JwtProperties props, Environment environment) {
        boolean perfilDev = environment.acceptsProfiles(Profiles.of("dev"));
        if (JwtProperties.DEV_DEFAULT_SECRET.equals(props.secret()) && !perfilDev) {
            throw new IllegalStateException(
                    "JWT_SECRET es el valor de desarrollo publicado en .env.example: configura uno real "
                            + "(minimo 32 bytes aleatorios) fuera del perfil dev.");
        }
    }
}
