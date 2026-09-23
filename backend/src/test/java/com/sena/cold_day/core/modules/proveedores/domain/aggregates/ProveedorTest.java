package com.sena.cold_day.core.modules.proveedores.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.shared.domain.Point;

class ProveedorTest {

    private static final Point UBICACION = new Point(7.8950, -72.5010);

    @Test
    void createsAnActiveSupplierLinkedToExactlyOneUsuario() {
        Proveedor proveedor = Proveedor.crear(7L, "Suministros del Norte", "900123456-1", "3105550001",
                "Avenida 6 # 10-50", UBICACION, Set.of("REFRIGERACION"));

        assertThat(proveedor.getId()).isNotNull();
        assertThat(proveedor.getId().valor()).isNotNull();
        assertThat(proveedor.getUsuarioId()).isEqualTo(7L);
        assertThat(proveedor.getRazonSocial()).isEqualTo("Suministros del Norte");
        assertThat(proveedor.getNit()).isEqualTo("900123456-1");
        assertThat(proveedor.getTelefono()).isEqualTo("3105550001");
        assertThat(proveedor.getDireccion()).isEqualTo("Avenida 6 # 10-50");
        assertThat(proveedor.getUbicacion()).isEqualTo(UBICACION);
        assertThat(proveedor.getCategoriasInsumo()).containsExactly("REFRIGERACION");
        assertThat(proveedor.isActivo()).isTrue();
        assertThat(proveedor.getCreadoEn()).isNotNull();
    }

    @Test
    void requiresALinkedUsuario() {
        assertThatThrownBy(() -> Proveedor.crear(null, "Suministros del Norte", "900123456-1", null,
                null, null, Set.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("usuario");
    }

    @Test
    void requiresRazonSocial() {
        assertThatThrownBy(() -> Proveedor.crear(7L, "  ", "900123456-1", null, null, null, Set.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("razon social");
    }

    @Test
    void requiresNit() {
        assertThatThrownBy(() -> Proveedor.crear(7L, "Suministros del Norte", null, null, null, null, Set.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NIT");
    }

    @Test
    void deactivateAndReactivateToggleTheEligibilityState() {
        Proveedor proveedor = Proveedor.crear(7L, "Suministros del Norte", "900123456-1", null, null, null, Set.of());

        proveedor.desactivar();
        assertThat(proveedor.isActivo()).isFalse();

        proveedor.activar();
        assertThat(proveedor.isActivo()).isTrue();
    }

    @Test
    void nullCategoriasBecomeAnEmptyUnmodifiableSet() {
        Proveedor proveedor = Proveedor.crear(7L, "Suministros del Norte", "900123456-1", null, null, null, null);

        assertThat(proveedor.getCategoriasInsumo()).isEmpty();
        assertThatThrownBy(() -> proveedor.getCategoriasInsumo().add("X"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void reconstituirRestoresFullStateIncludingInactive() {
        ProveedorId id = ProveedorId.nueva();
        Instant creadoEn = Instant.parse("2026-01-01T10:00:00Z");

        Proveedor proveedor = Proveedor.reconstituir(id, 9L, "Suministros del Norte", "900123456-1",
                "3105550001", "Avenida 6 # 10-50", UBICACION, Set.of("REFRIGERACION"), false, creadoEn);

        assertThat(proveedor.getId()).isEqualTo(id);
        assertThat(proveedor.getUsuarioId()).isEqualTo(9L);
        assertThat(proveedor.getUbicacion()).isEqualTo(UBICACION);
        assertThat(proveedor.getCategoriasInsumo()).containsExactly("REFRIGERACION");
        assertThat(proveedor.isActivo()).isFalse();
        assertThat(proveedor.getCreadoEn()).isEqualTo(creadoEn);
    }
}
