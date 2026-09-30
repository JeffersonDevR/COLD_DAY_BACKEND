package com.sena.cold_day.core.shared.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Spec R1: the V10 migration contract, asserted directly against the catalog.
 *
 * <p>This is also the explicit-failure proof for the missing-migration scenario:
 * reaching any assertion here means the context started, and the context starts
 * with {@code ddl-auto=validate}. If V10 were absent, this class would fail
 * during context initialization instead of silently degrading.
 */
@SpringBootTest
class EsquemaAuditoriaIT {

    private static final List<String> TABLAS = List.of("clientes", "tecnico", "ot", "proveedor");

    private static final List<String> COLUMNAS = List.of(
            "created_at", "updated_at", "created_by", "last_modified_by");

    @Autowired JdbcTemplate jdbc;

    @Test
    void cadaTablaAuditadaTieneLasCuatroColumnasDeAuditoria() {
        for (String tabla : TABLAS) {
            assertThat(columnasDe(tabla))
                    .as("columnas de auditoria de %s", tabla)
                    .containsAll(COLUMNAS);
        }
    }

    @Test
    void losInstantesSonTimestamptzYAdmitenNull() {
        for (String tabla : TABLAS) {
            for (String columna : List.of("created_at", "updated_at")) {
                assertThat(tipoDe(tabla, columna))
                        .as("%s.%s", tabla, columna)
                        .isEqualTo("timestamp with time zone");
                assertThat(esNullable(tabla, columna))
                        .as("%s.%s nullable", tabla, columna)
                        .isTrue();
            }
        }
    }

    @Test
    void losAuditoresSonVarchar255YAdmitenNull() {
        for (String tabla : TABLAS) {
            for (String columna : List.of("created_by", "last_modified_by")) {
                assertThat(tipoDe(tabla, columna))
                        .as("%s.%s", tabla, columna)
                        .isEqualTo("character varying");
                assertThat(largoDe(tabla, columna))
                        .as("%s.%s longitud", tabla, columna)
                        .isEqualTo(255);
                assertThat(esNullable(tabla, columna))
                        .as("%s.%s nullable", tabla, columna)
                        .isTrue();
            }
        }
    }

    /**
     * Checks the auditor columns themselves, not the table: {@code usuario_id}
     * legitimately carries a foreign key to {@code usuario} from V2, and the
     * point of V10 is that {@code created_by} / {@code last_modified_by} do not.
     */
    @Test
    void ningunaColumnaAuditoraParticipaEnUnaClaveForanea() {
        for (String tabla : TABLAS) {
            List<String> columnasConFk = jdbc.queryForList("""
                    SELECT a.attname
                    FROM pg_constraint c
                    JOIN unnest(c.conkey) AS k(attnum) ON true
                    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
                    WHERE c.contype = 'f' AND c.conrelid = CAST(? AS regclass)
                    """, String.class, tabla);

            assertThat(columnasConFk)
                    .as("columnas con clave foranea en %s", tabla)
                    .doesNotContainAnyElementsOf(COLUMNAS);
        }
    }

    @Test
    void cadaColumnaAuditoraDocumentada() {
        // The COMMENT ON COLUMN statements are part of the migration contract:
        // they are how a future maintainer discovers the "system" sentinel and
        // the deliberate absence of a foreign key.
        for (String tabla : TABLAS) {
            for (String columna : COLUMNAS) {
                Boolean documentada = jdbc.queryForObject("""
                        SELECT col_description(CAST(? AS regclass)::oid, ordinal_position) IS NOT NULL
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                        """, Boolean.class, "public." + tabla, tabla, columna);

                assertThat(documentada).as("comentario de %s.%s", tabla, columna).isTrue();
            }
        }
    }

    @Test
    void lasColumnasDeNegocioSiguenSiendoColumnasDeNegocio() {
        // The three business timestamps must be untouched by V10.
        assertThat(columnasDe("ot")).contains("creada_en");
        assertThat(columnasDe("proveedor")).contains("creado_en");
        assertThat(columnasDe("tecnico")).contains("ubicacion_actualizada_en");
    }

    private List<String> columnasDe(String tabla) {
        return jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ?
                """, String.class, tabla);
    }

    private String tipoDe(String tabla, String columna) {
        return jdbc.queryForObject("""
                SELECT data_type FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """, String.class, tabla, columna);
    }

    private Integer largoDe(String tabla, String columna) {
        return jdbc.queryForObject("""
                SELECT character_maximum_length FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """, Integer.class, tabla, columna);
    }

    private boolean esNullable(String tabla, String columna) {
        String isNullable = jdbc.queryForObject("""
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """, String.class, tabla, columna);
        return "YES".equals(isNullable);
    }
}
