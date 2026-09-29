package com.sena.cold_day.support;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.springframework.test.context.TestContext;
import org.springframework.test.context.support.AbstractTestExecutionListener;

/**
 * Deja la base vacia antes de cada test. Con PostgreSQL real las claves foraneas
 * se aplican (V2), asi que un test que deja filas sin borrar en orden — algo que
 * H2 sin FKs toleraba — rompe a los siguientes. Un {@code TRUNCATE ... CASCADE}
 * global evita depender de que cada clase limpie en el orden correcto.
 * <p>
 * Corre despues de la inyeccion de dependencias (2000) y antes de que
 * {@code @Transactional} abra la transaccion del test (4000), por lo que el
 * TRUNCATE no compite con ella por locks. Registrado en
 * {@code META-INF/spring.factories} de test.
 */
public class LimpiezaBaseDatosListener extends AbstractTestExecutionListener {

    private static final String SQL_TABLAS = """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('flyway_schema_history', 'spatial_ref_sys')
            """;

    private static volatile String truncate;

    @Override
    public int getOrder() {
        return 3000;
    }

    @Override
    public void beforeTestMethod(TestContext testContext) throws SQLException {
        var contexto = testContext.getApplicationContext();
        if (contexto.getBeanNamesForType(DataSource.class).length == 0) {
            return;
        }
        try (Connection c = contexto.getBean(DataSource.class).getConnection();
                Statement st = c.createStatement()) {
            if (truncate == null) {
                truncate = construirTruncate(st);
            }
            st.execute(truncate);
        }
    }

    private static String construirTruncate(Statement st) throws SQLException {
        List<String> tablas = new ArrayList<>();
        try (ResultSet rs = st.executeQuery(SQL_TABLAS)) {
            while (rs.next()) {
                tablas.add('"' + rs.getString(1) + '"');
            }
        }
        return "TRUNCATE TABLE " + String.join(", ", tablas) + " CASCADE";
    }
}
