package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorCercano;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
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

    // Centro en Bogota; 1 grado de latitud ~ 111.19 km, asi que +0.0809 ~ 9.0 km y +0.0989 ~ 11.0 km.
    private static final Point CENTRO = new Point(4.6097, -74.0817);

    private Proveedor proveedorEn(String correo, String nit, Point ubicacion, EstadoValidacionProveedor estado,
            boolean activo) {
        Long usuarioId = persistUsuario(correo);
        Proveedor base = Proveedor.crear(usuarioId, "Proveedor " + nit, nit, "3105550001", "Calle 1",
                ubicacion, Set.of("REFRIGERACION"));
        return repository.save(Proveedor.reconstituir(ProveedorId.nueva(), usuarioId, "Proveedor " + nit, nit,
                "3105550001", "Calle 1", ubicacion, Set.of("REFRIGERACION"), estado, null, activo,
                base.getCreadoEn()));
    }

    @Test
    void radioDevuelveSoloAprobadosActivosConUbicacionDentroDelRadio() {
        Proveedor cerca = proveedorEn("a@x.com", "900-1", new Point(4.6097 + 0.0809, -74.0817),
                EstadoValidacionProveedor.APROBADO, true);

        var resultado = repository.buscarElegiblesEnRadio(CENTRO, 10.0);

        assertThat(resultado).extracting(ProveedorCercano::proveedorId).containsExactly(cerca.getId());
    }

    @Test
    void radioExcluyePendienteSuspendidoInactivoYSinUbicacion() {
        Point dentro = new Point(4.6097 + 0.03, -74.0817);
        proveedorEn("p@x.com", "900-2", dentro, EstadoValidacionProveedor.PENDIENTE, true);
        proveedorEn("s@x.com", "900-3", dentro, EstadoValidacionProveedor.SUSPENDIDO, true);
        proveedorEn("r@x.com", "900-4", dentro, EstadoValidacionProveedor.RECHAZADO, true);
        proveedorEn("i@x.com", "900-5", dentro, EstadoValidacionProveedor.APROBADO, false);
        proveedorEn("n@x.com", "900-6", null, EstadoValidacionProveedor.APROBADO, true);

        assertThat(repository.buscarElegiblesEnRadio(CENTRO, 25.0)).isEmpty();
    }

    @Test
    void radioOrdenaPorDistanciaYExponeKilometros() {
        Proveedor lejos = proveedorEn("l@x.com", "900-7", new Point(4.6097 + 0.0809, -74.0817),
                EstadoValidacionProveedor.APROBADO, true);
        Proveedor cerca = proveedorEn("c@x.com", "900-8", new Point(4.6097 + 0.03, -74.0817),
                EstadoValidacionProveedor.APROBADO, true);

        var resultado = repository.buscarElegiblesEnRadio(CENTRO, 10.0);

        assertThat(resultado).extracting(ProveedorCercano::proveedorId).containsExactly(cerca.getId(), lejos.getId());
        assertThat(resultado.get(0).distanciaKm()).isBetween(3.2, 3.5);
        assertThat(resultado.get(1).distanciaKm()).isBetween(8.9, 9.1);
    }

    @Test
    void radioNoIncluyeProveedoresFueraDelBorde() {
        proveedorEn("f@x.com", "900-9", new Point(4.6097 + 0.0989, -74.0817),
                EstadoValidacionProveedor.APROBADO, true);

        assertThat(repository.buscarElegiblesEnRadio(CENTRO, 10.0)).isEmpty();
        assertThat(repository.buscarElegiblesEnRadio(CENTRO, 15.0)).hasSize(1);
    }

    @Test
    void radioRechazaCentroNuloYRadioNoPositivo() {
        assertThatThrownBy(() -> repository.buscarElegiblesEnRadio(null, 10.0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> repository.buscarElegiblesEnRadio(CENTRO, 0.0))
                .isInstanceOf(IllegalArgumentException.class);
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
    void roundTripsTheValidationStateInsteadOfResettingItToPendiente() {
        Long usuarioId = persistUsuario("validado@example.com");
        Proveedor proveedor = proveedor(usuarioId, "900123456-6", true);
        proveedor.aprobarValidacion(LocalDate.of(2026, 1, 1),
                List.of(new DocumentoProveedor(1L, proveedor.getId(), "RUT", LocalDate.of(2027, 1, 1))));
        Proveedor saved = repository.save(proveedor);

        // A read that defaulted the state would silently un-approve the supplier
        // and make exigirValidado() meaningless.
        assertThat(repository.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstadoValidacion()).isEqualTo(EstadoValidacionProveedor.APROBADO);
            assertThat(found.getMotivoRechazoValidacion()).isNull();
        });
    }

    @Test
    void persistsTheRejectionReason() {
        Long usuarioId = persistUsuario("rechazado@example.com");
        Proveedor proveedor = proveedor(usuarioId, "900123456-7", true);
        proveedor.rechazarValidacion("RUT vencido");
        Proveedor saved = repository.save(proveedor);

        assertThat(repository.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstadoValidacion()).isEqualTo(EstadoValidacionProveedor.RECHAZADO);
            assertThat(found.getMotivoRechazoValidacion()).isEqualTo("RUT vencido");
        });
    }

    @Test
    void rejectsDuplicateNit() {
        repository.save(proveedor(persistUsuario("uno@example.com"), "900123456-5", true));

        assertThatThrownBy(() -> repository.save(proveedor(persistUsuario("dos@example.com"), "900123456-5", true)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
