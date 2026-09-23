package com.sena.cold_day.core.modules.proveedores.domain.aggregates;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Supplier (Proveedor) identity aggregate. A Proveedor is the commercial party
 * that fulfills insumo requests; it holds a business identity (razon social,
 * NIT, contact data and service location) and is linked to exactly one Usuario
 * account (spec P1). Its active/inactive state gates dispatch eligibility
 * (spec P5, design AD7).
 *
 * <p>{@code categoriasInsumo} is descriptive metadata, never an eligibility
 * gate: broadcast targets every {@code activo = true} supplier (design AD7).
 */
public class Proveedor {

    private ProveedorId id;
    private Long usuarioId;
    private String razonSocial;
    private String nit;
    private String telefono;
    private String direccion;
    private Point ubicacion;
    private Set<String> categoriasInsumo = new LinkedHashSet<>();
    private boolean activo = true;
    private Instant creadoEn;

    private Proveedor() {
    }

    /**
     * Creates an active supplier linked to exactly one Usuario. The linked
     * account is a hard invariant: a Proveedor MUST NOT exist without it
     * (spec P1), so a missing {@code usuarioId} fails before any state exists.
     */
    public static Proveedor crear(Long usuarioId, String razonSocial, String nit, String telefono,
            String direccion, Point ubicacion, Set<String> categoriasInsumo) {
        if (usuarioId == null) {
            throw new IllegalArgumentException("El proveedor requiere un usuario vinculado");
        }
        if (razonSocial == null || razonSocial.isBlank()) {
            throw new IllegalArgumentException("La razon social es requerida");
        }
        if (nit == null || nit.isBlank()) {
            throw new IllegalArgumentException("El NIT es requerido");
        }
        Proveedor proveedor = new Proveedor();
        proveedor.id = ProveedorId.nueva();
        proveedor.usuarioId = usuarioId;
        proveedor.razonSocial = razonSocial;
        proveedor.nit = nit;
        proveedor.telefono = telefono;
        proveedor.direccion = direccion;
        proveedor.ubicacion = ubicacion;
        proveedor.reemplazarCategorias(categoriasInsumo);
        proveedor.activo = true;
        proveedor.creadoEn = Instant.now();
        return proveedor;
    }

    /** Reconstitution from persistence: restores the full aggregate state. */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado. Un objeto parametro ocultaria el mapeo con ProveedorJpaEntity.
    public static Proveedor reconstituir(ProveedorId id, Long usuarioId, String razonSocial, String nit,
            String telefono, String direccion, Point ubicacion, Set<String> categoriasInsumo,
            boolean activo, Instant creadoEn) {
        Proveedor proveedor = crear(usuarioId, razonSocial, nit, telefono, direccion, ubicacion, categoriasInsumo);
        proveedor.id = id;
        proveedor.activo = activo;
        proveedor.creadoEn = creadoEn;
        return proveedor;
    }

    public void reemplazarCategorias(Set<String> categorias) {
        this.categoriasInsumo.clear();
        if (categorias != null) {
            this.categoriasInsumo.addAll(categorias);
        }
    }

    /** Inactive suppliers are excluded from dispatch and cannot accept it (spec P5). */
    public void desactivar() {
        this.activo = false;
    }

    public void activar() {
        this.activo = true;
    }

    public ProveedorId getId() {
        return id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public String getRazonSocial() {
        return razonSocial;
    }

    public String getNit() {
        return nit;
    }

    public String getTelefono() {
        return telefono;
    }

    public String getDireccion() {
        return direccion;
    }

    public Point getUbicacion() {
        return ubicacion;
    }

    public Set<String> getCategoriasInsumo() {
        return Collections.unmodifiableSet(categoriasInsumo);
    }

    public boolean isActivo() {
        return activo;
    }

    public Instant getCreadoEn() {
        return creadoEn;
    }
}
