package com.sena.cold_day.support;

import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Levanta un unico PostgreSQL/PostGIS (misma imagen que el contenedor local
 * {@code coldday-postgis}) por JVM de test y apunta el DataSource de todos los
 * contextos de Spring hacia el. Se registra en
 * {@code META-INF/spring.factories} de test, asi no hace falta anotar cada clase.
 * <p>
 * Flyway aplica {@code db/migration} sobre el contenedor vacio la primera vez;
 * los contextos siguientes lo reutilizan. Ryuk (Testcontainers) lo elimina al
 * terminar la JVM. Requiere Docker en ejecucion.
 */
public class PostgisContainerInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final DockerImageName IMAGEN = DockerImageName.parse("postgis/postgis:16-3.4")
            .asCompatibleSubstituteFor("postgres");

    private static final PostgreSQLContainer POSTGIS = new PostgreSQLContainer(IMAGEN)
            .withDatabaseName("cold_day")
            .withUsername("cold_day")
            .withPassword("cold_day")
            // Varios contextos de Spring quedan cacheados a la vez, cada uno con su pool.
            .withCommand("postgres", "-c", "max_connections=300");

    static {
        POSTGIS.start();
    }

    @Override
    public void initialize(ConfigurableApplicationContext context) {
        TestPropertyValues.of(
                "spring.datasource.url=" + POSTGIS.getJdbcUrl(),
                "spring.datasource.username=" + POSTGIS.getUsername(),
                "spring.datasource.password=" + POSTGIS.getPassword(),
                "spring.datasource.hikari.maximum-pool-size=4")
                .applyTo(context.getEnvironment());
    }
}
