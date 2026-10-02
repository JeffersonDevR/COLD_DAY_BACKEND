package com.sena.cold_day.support;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Crea las filas padre minimas que exigen las claves foraneas de {@code V2}
 * (usuario, clientes, tecnico, proveedor, ot, requerimiento_insumo) para que los
 * tests de repositorio puedan persistir hijos con ids conocidos sin violar la
 * integridad referencial.
 * <p>
 * Usa JDBC directo (no los adaptadores ni los agregados) para no acoplar estos
 * fixtures a la logica de dominio que el test no esta probando. Cada metodo es
 * idempotente por id ({@code ON CONFLICT DO NOTHING}) y participa de la
 * transaccion del test si existe una (p. ej. {@code @DataJpaTest}); en tests sin
 * transaccion las filas se confirman y las limpia {@code LimpiezaBaseDatosListener}.
 */
public final class FkFixtures {

    private final JdbcTemplate jdbc;

    public FkFixtures(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Inserta un usuario nuevo con correo unico y devuelve su id. */
    public long usuario(String rol) {
        Long id = jdbc.queryForObject("""
                INSERT INTO usuario (nombre, correo, password_hash, rol, fecha_registro,
                                     habeas_data_aceptado, activo, token_version)
                VALUES ('Fixture', ?, 'x', ?, ?, true, true, 0)
                RETURNING id
                """, Long.class, "fx-" + UUID.randomUUID() + "@example.com", rol, LocalDateTime.now());
        return id;
    }

    public UUID cliente(UUID id) {
        if (!existe("clientes", id)) {
            jdbc.update("INSERT INTO clientes (id, usuario_id, tipo, activo) VALUES (?, ?, 'B2C', true)",
                    id, usuario("CLIENTE"));
        }
        return id;
    }

    public UUID tecnico(UUID id) {
        if (!existe("tecnico", id)) {
            jdbc.update("""
                    INSERT INTO tecnico (id, usuario_id, numero_identificacion, estado_validacion,
                                         activo, tracking_activo)
                    VALUES (?, ?, ?, 'PENDIENTE', true, false)
                    """, id, usuario("TECNICO"), "FX-" + id);
        }
        return id;
    }

    /**
     * Crea el proveedor en estado APROBADO.
     *
     * <p>APROBADO y no PENDIENTE a proposito: V8 dejo {@code estado_validacion}
     * NOT NULL y sin DEFAULT, para que toda insercion declare su estado en
     * lugar de heredar un PENDIENTE silencioso. Como el fixture escribe por
     * JDBC crudo, no pasa por el registro de proveedor, y varios tests aceptan
     * insumos sobre el: un proveedor PENDIENTE los rechazaria por
     * {@code exigirValidado()} y el fallo apareceria como asercion en vez del
     * problema real, que es que el fixture no puede ni insertarse.
     */
    public UUID proveedor(UUID id) {
        if (!existe("proveedor", id)) {
            jdbc.update("""
                    INSERT INTO proveedor (id, usuario_id, razon_social, nit, activo,
                                           estado_validacion)
                    VALUES (?, ?, 'Fixture SAS', ?, true, 'APROBADO')
                    """, id, usuario("PROVEEDOR"), "FX-" + id);
        }
        return id;
    }

    /** Crea la OT (y su cliente) en estado SOLICITADA si no existe. */
    public UUID ot(UUID id) {
        if (!existe("ot", id)) {
            jdbc.update("INSERT INTO ot (id, cliente_id, estado, auxiliares_requeridos, version) "
                    + "VALUES (?, ?, 'SOLICITADA', 0, 0)", id, cliente(UUID.randomUUID()));
        }
        return id;
    }

    /** Crea el requerimiento de insumo (con su OT y tecnico) si no existe. */
    public UUID requerimiento(UUID id) {
        if (!existe("requerimiento_insumo", id)) {
            jdbc.update("INSERT INTO requerimiento_insumo (id, ot_id, tecnico_id, estado, version) "
                    + "VALUES (?, ?, ?, 'SOLICITADO', 0)",
                    id, ot(UUID.randomUUID()), tecnico(UUID.randomUUID()));
        }
        return id;
    }

    /** Id de dominio de un cliente nuevo ya persistido. */
    public ClienteId clienteId() {
        return new ClienteId(cliente(UUID.randomUUID()));
    }

    /** Id de dominio de un tecnico nuevo ya persistido. */
    public TecnicoId tecnicoId() {
        return new TecnicoId(tecnico(UUID.randomUUID()));
    }

    /** Id de dominio de un proveedor nuevo ya persistido. */
    public ProveedorId proveedorId() {
        return new ProveedorId(proveedor(UUID.randomUUID()));
    }

    /** Id de dominio de una OT nueva ya persistida (con su cliente). */
    public OtId otId() {
        return new OtId(ot(UUID.randomUUID()));
    }

    /**
     * Borra los padres creados por estos fixtures, hijos primero, para los tests
     * cuyo {@code @BeforeEach}/{@code @AfterEach} limpia con {@code deleteAll()} y
     * despues borra usuarios. Las tablas hijas de {@code ot}/{@code tecnico} deben
     * haberse vaciado antes.
     */
    public void limpiarPadres() {
        jdbc.update("DELETE FROM ot");
        jdbc.update("DELETE FROM tecnico");
        jdbc.update("DELETE FROM clientes");
    }

    private boolean existe(String tabla, UUID id) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM " + tabla + " WHERE id = ?", Integer.class, id);
        return n != null && n > 0;
    }
}
