package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.ProveedorRepositoryAdapter;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

@DataJpaTest
@Import(ProveedorRepositoryAdapter.class)
class ProveedorRepositoryTest {

    @Autowired ProveedorRepositoryAdapter repository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    void cleanup() {
        repository.deleteAll();
        usuarioRepository.deleteAll();
    }

    /** Saves the user first: proveedor.usuario_id references usuario.id. */
    private Long persistUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Suministros", correo, "secreto", null, null,
                Rol.PROVEEDOR, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private Proveedor proveedor(Long usuarioId, String nit, boolean activo) {
        Proveedor proveedor = Proveedor.crear(usuarioId, "Suministros del Norte", nit, "3105550001",
                "Avenida 6 # 10-50", new Point(7.8950, -72.5010), Set.of("REFRIGERACION"));
        if (!activo) {
            proveedor.desactivar();
        }
        return proveedor;
    }

    @Test
    void savesAndFindsByUsuarioId() {
        Long usuarioId = persistUsuario("proveedor@example.com");
        Proveedor saved = repository.save(proveedor(usuarioId, "900123456-1", true));

        assertThat(repository.findByUsuarioId(usuarioId)).hasValueSatisfying(found -> {
            assertThat(found.getId()).isEqualTo(saved.getId());
            assertThat(found.getUsuarioId()).isEqualTo(usuarioId);
            assertThat(found.getRazonSocial()).isEqualTo("Suministros del Norte");
            assertThat(found.getNit()).isEqualTo("900123456-1");
            assertThat(found.isActivo()).isTrue();
        });
    }

    @Test
    void roundTripsLocationAndCategorias() {
        Long usuarioId = persistUsuario("geo@example.com");
        Proveedor saved = repository.save(proveedor(usuarioId, "900123456-2", true));

        assertThat(repository.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getUbicacion()).isEqualTo(new Point(7.8950, -72.5010));
            assertThat(found.getCategoriasInsumo()).containsExactly("REFRIGERACION");
            assertThat(found.getCreadoEn()).isNotNull();
        });
    }

    @Test
    void activeLookupExcludesInactiveSuppliers() {
        repository.save(proveedor(persistUsuario("activo@example.com"), "900123456-3", true));
        Proveedor inactive = repository.save(proveedor(persistUsuario("inactivo@example.com"), "900123456-4", false));

        assertThat(repository.findByActivoTrue())
                .hasSize(1)
                .allSatisfy(found -> assertThat(found.isActivo()).isTrue());
        assertThat(repository.buscarPorId(inactive.getId()))
                .hasValueSatisfying(found -> assertThat(found.isActivo()).isFalse());
    }

    @Test
    void rejectsDuplicateNit() {
        repository.save(proveedor(persistUsuario("uno@example.com"), "900123456-5", true));

        assertThatThrownBy(() -> repository.save(proveedor(persistUsuario("dos@example.com"), "900123456-5", true)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
