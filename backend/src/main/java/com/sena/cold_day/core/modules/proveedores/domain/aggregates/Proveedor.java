package com.sena.cold_day.core.modules.proveedores.domain.aggregates;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.exception.DocumentacionProveedorIncompletaException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoValidadoException;
import com.sena.cold_day.core.modules.proveedores.domain.services.TransicionesProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;
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
 *
 * <p>Dispatch eligibility is the conjunction of two independent facts, and both
 * are enforced here: the operator-controlled {@code activo} flag and the
 * documentary validation state. {@code activo} alone was an authorization hole —
 * a supplier could register and dispatch with nobody ever validating its
 * documents. {@link #exigirValidado()} closes it.
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
    private EstadoValidacionProveedor estadoValidacion;
    private String motivoRechazoValidacion;
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
        proveedor.estadoValidacion = EstadoValidacionProveedor.PENDIENTE;
        proveedor.creadoEn = Instant.now();
        return proveedor;
    }

    /**
     * Reconstitution from persistence that does not carry the validation state.
     * It delegates with {@code PENDIENTE} / {@code null}, which is the honest
     * value for a supplier nobody has ever validated. Only use it for a supplier
     * that genuinely has no validation history; {@code ProveedorJpaEntity} uses
     * the wider overload below so a persisted approval never resets on read.
     */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado. Un objeto parametro ocultaria el mapeo con ProveedorJpaEntity.
    public static Proveedor reconstituir(ProveedorId id, Long usuarioId, String razonSocial, String nit,
            String telefono, String direccion, Point ubicacion, Set<String> categoriasInsumo,
            boolean activo, Instant creadoEn) {
        return reconstituir(id, usuarioId, razonSocial, nit, telefono, direccion, ubicacion, categoriasInsumo,
                EstadoValidacionProveedor.PENDIENTE, null, activo, creadoEn);
    }

    /**
     * Reconstitution from persistence: restores the full aggregate state,
     * including the documentary validation cycle. The state and the rejection
     * reason come from the row, never from a default — a validation state that
     * reset to {@code PENDIENTE} on every read would silently make
     * {@link #exigirValidado()} meaningless.
     */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado. Un objeto parametro ocultaria el mapeo con ProveedorJpaEntity.
    public static Proveedor reconstituir(ProveedorId id, Long usuarioId, String razonSocial, String nit,
            String telefono, String direccion, Point ubicacion, Set<String> categoriasInsumo,
            EstadoValidacionProveedor estadoValidacion, String motivoRechazoValidacion,
            boolean activo, Instant creadoEn) {
        Proveedor proveedor = crear(usuarioId, razonSocial, nit, telefono, direccion, ubicacion, categoriasInsumo);
        proveedor.id = id;
        proveedor.estadoValidacion = estadoValidacion == null ? EstadoValidacionProveedor.PENDIENTE : estadoValidacion;
        proveedor.motivoRechazoValidacion = motivoRechazoValidacion;
        proveedor.activo = activo;
        proveedor.creadoEn = creadoEn;
        return proveedor;
    }

    /**
     * Approves documentary validation only when the supplier has at least one
     * document and every document is still vigente on {@code hoy}. An empty list
     * is a failure, not a vacuous success: "no documents" and "all documents
     * valid" are the same state here, and it is not {@code APROBADO}.
     *
     * <p>The documents are read by the caller, which owns the document
     * repository; this method owns the rule.
     */
    public void aprobarValidacion(LocalDate hoy, List<DocumentoProveedor> documentos) {
        if (hoy == null) {
            throw new IllegalArgumentException("La fecha de evaluacion es requerida");
        }
        if (documentos == null) {
            throw new IllegalArgumentException("Los documentos del proveedor son requeridos");
        }
        boolean documentacionAlDia = !documentos.isEmpty()
                && documentos.stream().allMatch(documento -> documento.estaVigente(hoy));
        if (!documentacionAlDia) {
            throw new DocumentacionProveedorIncompletaException(id);
        }
        TransicionesProveedor.validar(estadoValidacion, EstadoValidacionProveedor.APROBADO);
        this.estadoValidacion = EstadoValidacionProveedor.APROBADO;
        this.motivoRechazoValidacion = null;
    }

    /**
     * Rejects the documentation, recording why. A reason is mandatory: an
     * unexplained rejection is indistinguishable from a bug to the supplier.
     */
    public void rechazarValidacion(String motivo) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo del rechazo es requerido");
        }
        TransicionesProveedor.validar(estadoValidacion, EstadoValidacionProveedor.RECHAZADO);
        this.estadoValidacion = EstadoValidacionProveedor.RECHAZADO;
        this.motivoRechazoValidacion = motivo;
    }

    /**
     * The dispatch gate: raises {@link ProveedorNoValidadoException} unless the
     * documentation is approved. It deliberately does NOT subsume the
     * {@code activo} check: deactivation is an operator action on a commercial
     * account, validation is a documentary fact, and a supplier can hold either
     * without the other. Merging them would force one exception to mean two
     * different reasons.
     */
    public void exigirValidado() {
        if (!estadoValidacion.estaAprobado()) {
            throw new ProveedorNoValidadoException(id, estadoValidacion);
        }
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

    public EstadoValidacionProveedor getEstadoValidacion() {
        return estadoValidacion;
    }

    public String getMotivoRechazoValidacion() {
        return motivoRechazoValidacion;
    }

    public Instant getCreadoEn() {
        return creadoEn;
    }
}
