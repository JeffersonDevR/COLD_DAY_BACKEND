package com.sena.cold_day.core.shared.infrastructure.openapi;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/**
 * Expone el boton "Authorize" con JWT Bearer en Swagger UI. El esquema es
 * global: los endpoints publicos (registro, login, recuperacion y la propia
 * documentacion) simplemente ignoran el token.
 */
@Configuration
public class OpenApiConfig {

    public static final String JWT_SCHEME = "bearer-jwt";

    @Bean
    public OpenAPI coldDayOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Cold Day API")
                        .version("v1")
                        .description("API Cold Day. Autenticacion con JWT Bearer: "
                                + "haz login en POST /api/usuarios/login y pega el token en Authorize. "
                                + "Publicos sin token: POST /api/usuarios, /api/usuarios/login, "
                                + "/api/usuarios/recuperar-contrasena, /api/usuarios/reset-contrasena, "
                                + "POST /api/tecnicos y la documentacion.")
                        )
                .components(new Components().addSecuritySchemes(JWT_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(JWT_SCHEME));
    }
}
