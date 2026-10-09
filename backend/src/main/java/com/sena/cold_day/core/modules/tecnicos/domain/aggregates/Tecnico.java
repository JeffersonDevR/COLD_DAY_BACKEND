package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.DocumentacionIncompletaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.EspecialidadesRequeridasException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

public class Tecnico {

    /**
     * Validity window of the last reported position (RF-F1-27 live tracking).
     * <p>
     * The frontend pushes a position every 15 s while the tracking panel is open,
     * so 2 minutes tolerates browser tab throttling (a backgrounded tab may delay
     * or coalesce its pushes) while still expiring a closed tab: past this window
     * the stored coordinates are treated as "not reporting" even though
     * {@code trackingActivo} stays {@code true} for audit purposes.
     */
    public static final Duration UBICACION_VIGENCIA = Duration.ofMinutes(2);


    private TecnicoId id;
    private Long usuarioId;
    private String numeroIdentificacion;
    private final Set<CategoriaServicio> categoriasServicio = new HashSet<>();
    private EstadoOperativo estadoOperativo;
    private EstadoValidacion estadoValidacion;
    private String motivoRechazoValidacion;
    private final Set<Certificacion> certificaciones = new HashSet<>();
    private boolean activo = true;
    private Point ubicacion;
    private boolean trackingActivo;
    private Instant ubicacionActualizadaEn;

    private Tecnico() {
    }


    public static Tecnico crear(Long usuarioId, String numeroIdentificacion,
            Set<CategoriaServicio> categoriasServicio, Set<Certificacion> certificaciones) {
        Tecnico tecnico = new Tecnico();
        tecnico.id = TecnicoId.nueva();
        tecnico.usuarioId = usuarioId;
        tecnico.actualizarPerfil(numeroIdentificacion);
        tecnico.reemplazarCategorias(categoriasServicio);
        tecnico.reemplazarCertificaciones(certificaciones);
        tecnico.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
        tecnico.estadoValidacion = EstadoValidacion.PENDIENTE;
        tecnico.activo = true;
        return tecnico;
    }

    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado. Un objeto parametro ocultaria el mapeo con TecnicoJpaEntity.
    public static Tecnico reconstituir(TecnicoId id, Long usuarioId, String numeroIdentificacion,
                                       Set<CategoriaServicio> categoriasServicio, EstadoOperativo estadoOperativo,
                                       EstadoValidacion estadoValidacion, String motivoRechazoValidacion, Set<Certificacion> certificaciones,
                                       boolean activo, Point ubicacion, boolean trackingActivo, Instant ubicacionActualizadaEn) {

        Tecnico tecnico = crear(usuarioId, numeroIdentificacion, categoriasServicio, certificaciones);
        tecnico.id = id;
        tecnico.estadoOperativo = estadoOperativo;
        tecnico.estadoValidacion = estadoValidacion;
        tecnico.motivoRechazoValidacion = motivoRechazoValidacion;
        tecnico.activo = activo;
        tecnico.ubicacion = ubicacion;
        tecnico.trackingActivo = trackingActivo;
        tecnico.ubicacionActualizadaEn = ubicacionActualizadaEn;
        return tecnico;
    }

    public void actualizarPerfil(String numeroIdentificacion) {
        this.numeroIdentificacion = numeroIdentificacion;
    }


    /**
     * Approves documentary validation only when every certification is still
     * vigente (RF-F1-03). Document vigencia is enforced by the use case, which
     * owns the document repository.
     */
    public void aprobarValidacion(LocalDate hoy) {
        boolean certificacionesVigentes = certificaciones.stream()
                .allMatch(certificacion -> certificacion.estaVigente(hoy));
        if (!certificacionesVigentes) {
            throw new DocumentacionIncompletaException(id);
        }
        this.estadoValidacion = EstadoValidacion.APROBADO;
        this.motivoRechazoValidacion = null;
    }

    /** A document expired unrenewed: habilitation is suspended and the technician leaves service. */
    public void suspenderPorVencimiento() {
        this.estadoValidacion = EstadoValidacion.SUSPENDIDO;
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }


    public void rechazarValidacion(String motivo) {
        this.estadoValidacion = EstadoValidacion.RECHAZADO;
        this.motivoRechazoValidacion = motivo;
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }


    public void cambiarEstado(EstadoOperativo nuevoEstadoOperativo) {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id,estadoValidacion );
        }
        if (nuevoEstadoOperativo == EstadoOperativo.DISPONIBLE && estaBloqueadoPorLiquidacion()) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        if (estadoOperativo == EstadoOperativo.OCUPADO) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        if (estadoOperativo == EstadoOperativo.BLOQUEADO_POR_LIQUIDACION
                && nuevoEstadoOperativo != EstadoOperativo.FUERA_DE_SERVICIO) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        this.estadoOperativo = nuevoEstadoOperativo;
    }

    /** Same guard applies before accepting an order (CU-08, step 4). */
    public void aceptarOrden() {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id, estadoValidacion);
        }
        if (estadoOperativo != EstadoOperativo.DISPONIBLE) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        this.estadoOperativo = EstadoOperativo.OCUPADO;
    }

    /**
     * RF-F1-23 (CU-12): al cerrar un servicio en efectivo se calcula la comision
     * y el tecnico queda inmovilizado hasta consignar (CU-13). Solo un tecnico
     * validado puede bloquearse; el bloqueo es idempotente.
     */
    public void bloquearPorLiquidacion() {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id, estadoValidacion);
        }
        this.estadoOperativo = EstadoOperativo.BLOQUEADO_POR_LIQUIDACION;
    }

    /**
     * CU-13 / RF-F1-24: tras la aprobacion del comprobante por el administrador,
     * se reactiva la habilitacion operativa de forma inmediata. El tecnico
     * vuelve a FUERA_DE_SERVICIO y debe conmutar a DISPONIBLE (RF-F1-05).
     */
    public void desbloquearTrasConsignacion() {
        if (estadoOperativo != EstadoOperativo.BLOQUEADO_POR_LIQUIDACION) {
            throw new IllegalStateException("El tecnico no esta bloqueado por liquidacion");
        }
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }

    public boolean estaBloqueadoPorLiquidacion() {
        return estadoOperativo == EstadoOperativo.BLOQUEADO_POR_LIQUIDACION;
    }

    /**
     * Releases the assigned order when its OT reaches a terminal state or is
     * reassigned. An approved technician returns from {@code OCUPADO} to
     * {@code DISPONIBLE}; a technician whose validation is no longer
     * {@code APROBADO} (for example, suspended) is deliberately left untouched
     * so a terminal OT never makes an ineligible technician available.
     */
    public void liberarOrden() {
        if (estadoValidacion == EstadoValidacion.APROBADO && estadoOperativo == EstadoOperativo.OCUPADO) {
            this.estadoOperativo = EstadoOperativo.DISPONIBLE;
        }
    }

    public void reemplazarCategorias(Set<CategoriaServicio> categorias) {
        categoriasServicio.clear();
        if (categorias != null) {
            categoriasServicio.addAll(categorias);
        }
    }

    /**
     * Replaces the service categories of an existing technician, refusing a
     * null or empty set.
     * <p>
     * A technician with no specializations can never satisfy the radar filter
     * ({@code coincideCategoria}, RF-F1-04), so they would become silently
     * invisible to every client. Because this backs a self-service edit, the
     * rule is enforced here instead of letting the caller remove their last
     * specialization.
     * <p>
     * Kept separate from {@link #reemplazarCategorias(Set)}: that method is used
     * by creation and persistence rehydration, which must stay permissive
     * (including the empty set) to reconstruct incomplete or legacy profiles.
     */
    public void actualizarEspecialidades(Set<CategoriaServicio> categorias) {
        if (categorias == null || categorias.isEmpty()) {
            throw new EspecialidadesRequeridasException(id);
        }
        reemplazarCategorias(categorias);
    }

    public void reemplazarCertificaciones(Set<Certificacion> certificaciones) {
        this.certificaciones.clear();
        if (certificaciones != null) {
            this.certificaciones.addAll(certificaciones);
        }
    }

    public void agregarCertificacion(Certificacion certificacion) {
        certificaciones.add(certificacion);
    }

    public void eliminarCertificacion(Certificacion certificacion) {
        certificaciones.remove(certificacion);
    }

    public void desactivar() {
        activo = false;
    }

    /**
     * Captures a new coordinate and (re)activates real-time tracking (RF-F1-06).
     * Range validation lives in {@link Point}.
     */
    public void actualizarUbicacion(Point ubicacion, Instant ahora) {
        if (ubicacion == null) {
            throw new IllegalArgumentException("La ubicacion es requerida");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de actualizacion es requerido");
        }
        this.ubicacion = ubicacion;
        this.ubicacionActualizadaEn = ahora;
        this.trackingActivo = true;
    }

    /**
     * Terminal OT states stop real-time tracking while the final coordinates
     * remain persisted for audit (RF-F1-27, design D9).
     */
    public void desactivarTracking() {
        this.trackingActivo = false;
    }

    public void activarTracking() {
        this.trackingActivo = true;
    }

    /**
     * True only when the technician is actually reporting a live position, that
     * is: tracking is on, coordinates exist and the last update falls inside
     * {@link #UBICACION_VIGENCIA} of {@code ahora}. Coordinates that merely sit
     * in the aggregate (a closed tab, a terminal OT) are retained for audit but
     * are deliberately NOT fresh, so a reader of the live endpoint must not draw
     * a technician who has stopped moving.
     */
    public boolean reportaUbicacionVigente(Instant ahora) {
        if (ahora == null) {
            throw new IllegalArgumentException("The reference instant is required");
        }
        return trackingActivo
                && ubicacion != null
                && ubicacionActualizadaEn != null
                && ubicacionActualizadaEn.isAfter(ahora.minus(UBICACION_VIGENCIA));
    }

    public boolean isActivo() { return activo; }
    public Point getUbicacion() { return ubicacion; }
    public boolean isTrackingActivo() { return trackingActivo; }
    public Instant getUbicacionActualizadaEn() { return ubicacionActualizadaEn; }
    public TecnicoId getId() { return id; }
    public Long getUsuarioId() { return usuarioId; }
    public String getNumeroIdentificacion() { return numeroIdentificacion; }
    public Set<CategoriaServicio> getCategoriasServicio() { return Collections.unmodifiableSet(categoriasServicio); }
    public EstadoOperativo getEstadoOperativo() { return estadoOperativo; }
    public EstadoValidacion getEstadoValidacion() { return estadoValidacion; }
    public String getMotivoRechazoValidacion() { return motivoRechazoValidacion; }
    public Set<Certificacion> getCertificaciones() { return Collections.unmodifiableSet(certificaciones); }
}
