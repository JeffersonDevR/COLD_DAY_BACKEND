package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.clientes.infrastructure.repository.ClienteRepositoryAdapter;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;

@DataJpaTest
@Import(ClienteRepositoryAdapter.class)
class ClienteRepositoryTest {

    @Autowired ClienteRepositoryAdapter repository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    void cleanup() {
        repository.deleteAll();
        usuarioRepository.deleteAll();
    }

    private Long persistUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", null, null, Rol.CLIENTE, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private Cliente cliente(Long usuarioId, boolean activo) {
        DireccionPrincipal direccion = DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro");
        if (activo) {
            return Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C, direccion);
        }
        return Cliente.reconstituir(ClienteId.nueva(), new UsuarioId(usuarioId), TipoCliente.B2C, direccion, false);
    }

    @Test
    void savesAndFindsByUsuarioId() {
        Long usuarioId = persistUsuario("ana@example.com");
        Cliente saved = repository.save(cliente(usuarioId, true));

        assertThat(repository.findByUsuarioId(new UsuarioId(usuarioId))).hasValueSatisfying(found -> {
            assertThat(found.getId()).isEqualTo(saved.getId());
            assertThat(found.getUsuarioId()).isEqualTo(new UsuarioId(usuarioId));
            assertThat(found.getTipoCliente()).isEqualTo(TipoCliente.B2C);
            assertThat(found.getDireccionPrincipal())
                    .isEqualTo(DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro"));
            assertThat(found.isActivo()).isTrue();
        });
    }

    @Test
    void roundTripsInactiveFlagAndExcludesInactiveFromActiveLookup() {
        Long activoUsuario = persistUsuario("activo@example.com");
        Long inactivoUsuario = persistUsuario("inactivo@example.com");
        repository.save(cliente(activoUsuario, true));
        repository.save(cliente(inactivoUsuario, false));

        assertThat(repository.findByUsuarioId(new UsuarioId(inactivoUsuario)))
                .hasValueSatisfying(found -> assertThat(found.isActivo()).isFalse());
        assertThat(repository.findByActivoTrue())
                .hasSize(1)
                .allSatisfy(found -> assertThat(found.isActivo()).isTrue());
    }

    @Test
    void roundTripsAddressLocationWhenPresent() {
        Long usuarioId = persistUsuario("geo@example.com");
        DireccionPrincipal direccion = DireccionPrincipal.con(
                "Calle 1", "Bogota", "Centro", new Point(4.6, -74.0));
        repository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C, direccion));

        assertThat(repository.findByUsuarioId(new UsuarioId(usuarioId))).hasValueSatisfying(found -> {
            DireccionPrincipal persisted = found.getDireccionPrincipal();
            assertThat(persisted.tieneUbicacion()).isTrue();
            assertThat(persisted.getUbicacion().latitud()).isEqualTo(4.6);
            assertThat(persisted.getUbicacion().longitud()).isEqualTo(-74.0);
            assertThat(persisted).isEqualTo(direccion);
        });
    }

    @Test
    void roundTripsAddressWithoutLocation() {
        Long usuarioId = persistUsuario("sin-geo@example.com");
        DireccionPrincipal direccion = DireccionPrincipal.sinUbicacion("Calle 2", "Medellin", null);
        repository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C, direccion));

        assertThat(repository.findByUsuarioId(new UsuarioId(usuarioId))).hasValueSatisfying(found -> {
            DireccionPrincipal persisted = found.getDireccionPrincipal();
            assertThat(persisted.tieneUbicacion()).isFalse();
            assertThat(persisted.getUbicacion()).isNull();
            assertThat(persisted).isEqualTo(direccion);
        });
    }

    @Test
    void roundTripsAddressComponentsContainingReservedSeparator() {
        Long usuarioId = persistUsuario("pipe@example.com");
        DireccionPrincipal direccion = DireccionPrincipal.sinUbicacion(
                "Calle | 1", "Bogo|ta", "Cen|tro\\norte");
        repository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C, direccion));

        assertThat(repository.findByUsuarioId(new UsuarioId(usuarioId)))
                .hasValueSatisfying(found ->
                        assertThat(found.getDireccionPrincipal()).isEqualTo(direccion));
    }
}
