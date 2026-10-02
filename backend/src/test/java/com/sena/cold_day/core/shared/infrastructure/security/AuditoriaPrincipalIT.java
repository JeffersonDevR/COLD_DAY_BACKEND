package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.support.FkFixtures;

/**
 * Spec R4: with an {@link AuthenticatedUser} in the context, every audited
 * table stores that user's id rendered as a {@code String}.
 *
 * <p>The context is cleared in {@link #AfterEach}. Sibling classes share a
 * cached Spring context and one Testcontainers database, so a leaked
 * {@code SecurityContextHolder} would silently change what those tests store.
 */
@SpringBootTest
class AuditoriaPrincipalIT {

    private static final long USUARIO_ID = 4242L;

    @Autowired JdbcTemplate jdbc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ProveedorRepository proveedorRepository;
    @Autowired OtRepository otRepository;

    private FkFixtures fk;

    @BeforeEach
    void setUp() {
        fk = new FkFixtures(jdbc);
        instalarPrincipal(new UsuarioId(USUARIO_ID), Rol.ADMINISTRADOR);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void lasCuatroTablasGuardanElIdDelPrincipalAutenticado() {
        Cliente cliente = clienteRepository.save(Cliente.registrar(new UsuarioId(fk.usuario("CLIENTE")),
                TipoCliente.B2C, DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
        Tecnico tecnico = tecnicoRepository.save(Tecnico.crear(fk.usuario("TECNICO"),
                "PR-" + UUID.randomUUID(), Set.of(CategoriaServicio.REFRIGERACION), Set.of()));
        Proveedor proveedor = proveedorRepository.save(Proveedor.crear(fk.usuario("PROVEEDOR"),
                "Principal SAS", "NIT-" + UUID.randomUUID(), null, null, null, Set.of()));
        Ot ot = otRepository.save(Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION,
                "No enfria", List.of(), "Calle 1", new Point(4.7110, -74.0721), Instant.now()));

        assertThat(auditor("clientes", cliente.getId().valor())).isEqualTo("4242");
        assertThat(auditor("tecnico", tecnico.getId().valor())).isEqualTo("4242");
        assertThat(auditor("proveedor", proveedor.getId().valor())).isEqualTo("4242");
        assertThat(auditor("ot", ot.getId().valor())).isEqualTo("4242");
    }

    @Test
    void elAuditorCambiaConElPrincipalDeLaPeticion() {
        Cliente primero = clienteRepository.save(Cliente.registrar(new UsuarioId(fk.usuario("CLIENTE")),
                TipoCliente.B2C, DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));

        instalarPrincipal(new UsuarioId(777L), Rol.TECNICO);
        primero.actualizarDireccion(DireccionPrincipal.sinUbicacion("Calle 9", "Bogota", "Centro"));
        clienteRepository.save(primero);

        assertThat(columna("clientes", primero.getId().valor(), "last_modified_by")).isEqualTo("777");
    }

    @Test
    void createdByNoCambiaAlActualizarPeroLastModifiedBySi() {
        Cliente cliente = clienteRepository.save(Cliente.registrar(new UsuarioId(fk.usuario("CLIENTE")),
                TipoCliente.B2C, DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));

        instalarPrincipal(new UsuarioId(777L), Rol.TECNICO);
        cliente.actualizarDireccion(DireccionPrincipal.sinUbicacion("Calle 9", "Bogota", "Centro"));
        clienteRepository.save(cliente);

        assertThat(columna("clientes", cliente.getId().valor(), "created_by")).isEqualTo("4242");
        assertThat(columna("clientes", cliente.getId().valor(), "last_modified_by")).isEqualTo("777");
    }

    // ---------------------------------------------------------------- helpers --

    private void instalarPrincipal(UsuarioId usuarioId, Rol rol) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(usuarioId, rol), null, AuthorityUtils.NO_AUTHORITIES));
    }

    private String auditor(String tabla, UUID id) {
        return columna(tabla, id, "created_by");
    }

    private String columna(String tabla, UUID id, String columna) {
        return jdbc.queryForObject("SELECT " + columna + " FROM " + tabla + " WHERE id = ?",
                (rs, n) -> rs.getString(1), id);
    }
}
