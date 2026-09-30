package com.sena.cold_day.core.shared.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.clientes.infrastructure.persistence.ClienteJpaEntity;
import com.sena.cold_day.core.modules.clientes.infrastructure.persistence.SpringDataClienteRepository;
import com.sena.cold_day.core.shared.infrastructure.config.AuditoriaConfig;
import com.sena.cold_day.support.FkFixtures;

/**
 * Spec R9: the auditing setup lives in a dedicated importable
 * {@code @Configuration}, so a {@code @DataJpaTest} slice can switch auditing
 * on with a plain {@code @Import}.
 *
 * <p>This class deliberately carries NO {@code @EnableJpaAuditing}. If the
 * annotation only existed on {@code ColdDayApplication}, this slice would start
 * without auditing and every audit field would silently stay null — the exact
 * failure mode the dedicated configuration exists to prevent. The assertions
 * below are what catch that regression.
 */
@DataJpaTest
@Import(AuditoriaConfig.class)
class AuditoriaSliceTest {

    @Autowired SpringDataClienteRepository clientes;
    @Autowired JdbcTemplate jdbc;

    @Test
    void elSliceConAuditoriaImportadaGuardaLosMetadatos() {
        FkFixtures fx = new FkFixtures(jdbc);

        ClienteJpaEntity cliente = new ClienteJpaEntity();
        cliente.setId(UUID.randomUUID());
        cliente.setUsuarioId(fx.usuario("CLIENTE"));
        cliente.setTipo(TipoCliente.B2C);
        cliente.setActivo(true);

        clientes.saveAndFlush(cliente);

        assertThat(consultar(cliente.getId(), "created_at")).isNotNull();
        assertThat(consultar(cliente.getId(), "updated_at")).isNotNull();
        assertThat(texto(cliente.getId(), "created_by")).isEqualTo("system");
        assertThat(texto(cliente.getId(), "last_modified_by")).isEqualTo("system");
    }

    @Test
    void elSliceConAuditoriaImportadaRefrescaLaModificacion() {
        FkFixtures fx = new FkFixtures(jdbc);

        ClienteJpaEntity cliente = new ClienteJpaEntity();
        cliente.setId(UUID.randomUUID());
        cliente.setUsuarioId(fx.usuario("CLIENTE"));
        cliente.setTipo(TipoCliente.B2C);
        cliente.setActivo(true);
        clientes.saveAndFlush(cliente);
        Object createdAt = consultar(cliente.getId(), "created_at");

        cliente.setActivo(false);
        clientes.saveAndFlush(cliente);

        assertThat(consultar(cliente.getId(), "created_at")).isEqualTo(createdAt);
        assertThat(texto(cliente.getId(), "last_modified_by")).isEqualTo("system");
    }

    private Object consultar(UUID id, String columna) {
        return jdbc.queryForObject("SELECT " + columna + " FROM clientes WHERE id = ?",
                Object.class, id);
    }

    private String texto(UUID id, String columna) {
        return jdbc.queryForObject("SELECT " + columna + " FROM clientes WHERE id = ?",
                String.class, id);
    }
}
