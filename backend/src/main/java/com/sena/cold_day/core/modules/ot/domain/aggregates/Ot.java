package com.sena.cold_day.core.modules.ot.domain.aggregates;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.services.TransicionesOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Root aggregate of the OT lifecycle (design D1/D2/D3).
 *
 * <p>Every accepted transition is appended to an in-memory pending list of
 * {@link CambioEstado}; the persistence adapter drains it on save so no state
 * change is ever lost (RNF-09). Terminal states have no exits.
 */
public class Ot {

    /** Free client cancellation window measured from assignment (RF-F1-21). */
    public static final Duration VENTANA_CANCELACION_GRATUITA = Duration.ofMinutes(10);

    private OtId id;
    private ClienteId clienteId;
    private TecnicoId tecnicoId;
    private CategoriaServicio categoriaServicio;
    private String descripcionFalla;
    private List<String> evidenciaUrls = new ArrayList<>();
    private String direccion;
    private Point ubicacion;
    private EstadoOt estado;
    private double radioKm;
    private Instant ventanaExpiraEn;
    private Instant creadaEn;
    private Instant asignadaEn;
    private Instant finalizadaEn;
    private ActorOt canceladaPor;
    private MotivoCancelacion motivoCancelacion;
    private BigDecimal tarifaVisita;
    private Double distanciaKm;
    private TarifaFuente tarifaFuente;
    private Diagnostico diagnostico;
    private Presupuesto presupuesto;

    /** Pending state changes not yet persisted to the append-only history. */
    private final List<CambioEstado> cambiosPendientes = new ArrayList<>();

    private Ot() {
    }

    /**
     * Creates an OT as {@code SOLICITADA} (RF-F1-08) and records the initial
     * {@code ->SOLICITADA} history entry.
     */
    public static Ot crear(ClienteId clienteId, CategoriaServicio categoriaServicio, String descripcionFalla,
            List<String> evidenciaUrls, String direccion, Point ubicacion, Instant ahora) {
        if (clienteId == null) {
            throw new IllegalArgumentException("El cliente es requerido");
        }
        if (categoriaServicio == null) {
            throw new IllegalArgumentException("La categoria de servicio es requerida");
        }
        if (descripcionFalla == null || descripcionFalla.isBlank()) {
            throw new IllegalArgumentException("La descripcion de la falla es requerida");
        }
        if (ubicacion == null) {
            throw new IllegalArgumentException("La ubicacion es requerida");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de creacion es requerido");
        }

        Ot ot = new Ot();
        ot.id = OtId.nueva();
        ot.clienteId = clienteId;
        ot.categoriaServicio = categoriaServicio;
        ot.descripcionFalla = descripcionFalla;
        ot.evidenciaUrls = evidenciaUrls == null ? new ArrayList<>() : new ArrayList<>(evidenciaUrls);
        ot.direccion = direccion;
        ot.ubicacion = ubicacion;
        ot.estado = EstadoOt.SOLICITADA;
        ot.radioKm = 0.0;
        ot.creadaEn = ahora;
        ot.cambiosPendientes.add(new CambioEstado(null, EstadoOt.SOLICITADA, ActorOt.CLIENTE, ahora, null));
        return ot;
    }

    /**
     * Reconstitution from persistence without the authoritative tariff detail.
     * Kept as a delegating overload so the existing 19-argument call sites and
     * tests compile untouched (design AD3); the distance and source stay null.
     */
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto) {
        return reconstituir(id, clienteId, tecnicoId, categoriaServicio, descripcionFalla, evidenciaUrls,
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita, diagnostico, presupuesto, null, null);
    }

    /** Reconstitution from persistence. */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado (21 campos). Un Builder ocultaria el mapeo 1:1 con la entidad JPA.
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto, Double distanciaKm, TarifaFuente tarifaFuente) {
        Ot ot = new Ot();
        ot.id = id;
        ot.clienteId = clienteId;
        ot.tecnicoId = tecnicoId;
        ot.categoriaServicio = categoriaServicio;
        ot.descripcionFalla = descripcionFalla;
        ot.evidenciaUrls = evidenciaUrls == null ? new ArrayList<>() : new ArrayList<>(evidenciaUrls);
        ot.direccion = direccion;
        ot.ubicacion = ubicacion;
        ot.estado = estado;
        ot.radioKm = radioKm;
        ot.ventanaExpiraEn = ventanaExpiraEn;
        ot.creadaEn = creadaEn;
        ot.asignadaEn = asignadaEn;
        ot.finalizadaEn = finalizadaEn;
        ot.canceladaPor = canceladaPor;
        ot.motivoCancelacion = motivoCancelacion;
        ot.tarifaVisita = tarifaVisita;
        ot.distanciaKm = distanciaKm;
        ot.tarifaFuente = tarifaFuente;
        ot.diagnostico = diagnostico;
        ot.presupuesto = presupuesto;
        return ot;
    }

    /**
     * Persists the authoritative visit tariff computed server-side (spec
     * tar.R6, design AD9/AD13). Only the resulting amount, the distance it was
     * based on and whether that distance came from the maps provider or the
     * linear fallback are stored; the formula and the brackets never are, so
     * changing the pricing model needs no migration.
     */
    public void registrarTarifaVisita(BigDecimal tarifaVisita, Double distanciaKm, TarifaFuente tarifaFuente,
            Instant ahora) {
        if (ahora == null) {
            throw new IllegalArgumentException("El momento del registro de la tarifa es requerido");
        }
        this.tarifaVisita = tarifaVisita;
        this.distanciaKm = distanciaKm;
        this.tarifaFuente = tarifaFuente;
    }

    /**
     * All Phase-1 orders are urgent: creation immediately advances
     * {@code SOLICITADA -> BUSCANDO_TECNICO} and opens the first dispatch
     * window (RF-F1-08).
     */
    public void iniciarBusqueda(double radioKm, Instant ventanaExpiraEn, ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.BUSCANDO_TECNICO);
        this.estado = EstadoOt.BUSCANDO_TECNICO;
        this.radioKm = radioKm;
        this.ventanaExpiraEn = ventanaExpiraEn;
        registrarCambio(origen, EstadoOt.BUSCANDO_TECNICO, actor, ahora, null);
    }

    /**
     * Widens the search radius without changing the state (RF-F1-09); not a
     * state change, so it produces no history entry.
     */
    public void escalarRadio(double radioKm, Instant ventanaExpiraEn) {
        if (estado != EstadoOt.BUSCANDO_TECNICO) {
            throw new IllegalStateException(
                    "Solo se puede escalar el radio en BUSCANDO_TECNICO, estado actual: " + estado);
        }
        this.radioKm = radioKm;
        this.ventanaExpiraEn = ventanaExpiraEn;
    }

    /** Negative terminal state when no technician accepts at the maximum radius. */
    public void agotarOpciones(ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.SIN_TECNICOS_DISPONIBLES);
        this.estado = EstadoOt.SIN_TECNICOS_DISPONIBLES;
        registrarCambio(origen, EstadoOt.SIN_TECNICOS_DISPONIBLES, actor, ahora, null);
    }

    /** Cancels the OT before repair, recording actor and motivo (design D2). */
    public void cancelar(ActorOt canceladaPor, MotivoCancelacion motivo, Instant ahora) {
        cancelar(canceladaPor, motivo, motivo == null ? null : motivo.name(), ahora, null);
    }

    /**
     * Cancels the OT before repair with the mandatory free-text reason, the
     * actor attribution and (when applicable) the base visit fee (RF-F1-20/21).
     * The categorical {@code motivo} lands on the aggregate; the free-text
     * reason is audited on the history entry.
     */
    public void cancelar(ActorOt canceladaPor, MotivoCancelacion motivo, String razon, Instant ahora,
            BigDecimal tarifaVisita) {
        if (canceladaPor == null) {
            throw new IllegalArgumentException("El actor de la cancelacion es requerido");
        }
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.CANCELADA);
        this.estado = EstadoOt.CANCELADA;
        this.canceladaPor = canceladaPor;
        this.motivoCancelacion = motivo;
        this.tarifaVisita = tarifaVisita;
        registrarCambio(origen, EstadoOt.CANCELADA, canceladaPor, ahora, razon);
    }

    /**
     * True while a client cancellation is still free: the OT was assigned and
     * no more than {@link #VENTANA_CANCELACION_GRATUITA} has elapsed (RF-F1-21).
     */
    public boolean dentroDeVentanaGratuita(Instant ahora) {
        return asignadaEn != null && ahora != null
                && !ahora.isAfter(asignadaEn.plus(VENTANA_CANCELACION_GRATUITA));
    }

    /** Assigned technician starts the displacement ({@code ASIGNADA -> EN_CAMINO}). */
    public void iniciarDesplazamiento(ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.EN_CAMINO);
        this.estado = EstadoOt.EN_CAMINO;
        registrarCambio(origen, EstadoOt.EN_CAMINO, actor, ahora, null);
    }

    /**
     * Records the diagnosis and advances {@code EN_CAMINO -> EN_DIAGNOSTICO}
     * (RF-F1-11). The budget is attached separately through
     * {@link #presupuestar(Presupuesto)}.
     */
    public void registrarDiagnostico(Diagnostico diagnostico, ActorOt actor, Instant ahora) {
        if (diagnostico == null) {
            throw new IllegalArgumentException("El diagnostico es requerido");
        }
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.EN_DIAGNOSTICO);
        this.diagnostico = diagnostico;
        this.estado = EstadoOt.EN_DIAGNOSTICO;
        registrarCambio(origen, EstadoOt.EN_DIAGNOSTICO, actor, ahora, null);
    }

    /** Attaches the budget presented to the client; only valid in diagnosis. */
    public void presupuestar(Presupuesto presupuesto) {
        if (presupuesto == null) {
            throw new IllegalArgumentException("El presupuesto es requerido");
        }
        if (estado != EstadoOt.EN_DIAGNOSTICO) {
            throw new IllegalStateException(
                    "Solo se puede presupuestar en EN_DIAGNOSTICO, estado actual: " + estado);
        }
        this.presupuesto = presupuesto;
    }

    /** Client approval of the presented budget ({@code EN_DIAGNOSTICO -> EN_REPARACION}). */
    public void aprobarPresupuesto(ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.EN_REPARACION);
        this.estado = EstadoOt.EN_REPARACION;
        registrarCambio(origen, EstadoOt.EN_REPARACION, actor, ahora, null);
    }

    /** Completes the repair and lands the OT in its positive terminal state. */
    public void finalizar(ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.FINALIZADA);
        this.estado = EstadoOt.FINALIZADA;
        this.finalizadaEn = ahora;
        registrarCambio(origen, EstadoOt.FINALIZADA, actor, ahora, null);
    }

    /**
     * RF-F1-25: el cliente objeta el diagnostico o el trabajo entregado y la OT
     * pasa a mediacion del administrador. Solo legal desde EN_DIAGNOSTICO o
     * EN_REPARACION (SRS §5.2); el motivo queda auditado en el historial.
     */
    public void abrirDisputa(ActorOt actor, String motivo, Instant ahora) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo de la disputa es requerido");
        }
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.DISPUTADA);
        this.estado = EstadoOt.DISPUTADA;
        registrarCambio(origen, EstadoOt.DISPUTADA, actor, ahora, motivo);
    }

    /**
     * RF-F1-25: el administrador cierra la disputa con acuerdo; la orden se
     * cierra como FINALIZADA y dispara calificacion (RF-F1-15).
     */
    public void resolverDisputaConAcuerdo(ActorOt actor, Instant ahora) {
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.FINALIZADA);
        this.estado = EstadoOt.FINALIZADA;
        this.finalizadaEn = ahora;
        registrarCambio(origen, EstadoOt.FINALIZADA, actor, ahora, "Disputa resuelta con acuerdo");
    }

    /**
     * RF-F1-25: el administrador cierra la disputa sin acuerdo; la orden se
     * cierra como CANCELADA sin cobro, registrando el motivo para auditoria.
     */
    public void resolverDisputaSinAcuerdo(ActorOt actor, String motivo, Instant ahora) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo de la resolucion es requerido");
        }
        EstadoOt origen = this.estado;
        TransicionesOt.validar(origen, EstadoOt.CANCELADA);
        this.estado = EstadoOt.CANCELADA;
        this.canceladaPor = ActorOt.ADMINISTRADOR;
        this.motivoCancelacion = MotivoCancelacion.RESOLUCION_DISPUTA_SIN_ACUERDO;
        this.tarifaVisita = null;
        this.distanciaKm = null;
        this.tarifaFuente = null;
        registrarCambio(origen, EstadoOt.CANCELADA, actor, ahora, motivo);
    }

    public boolean esTerminal() {
        return estado != null && estado.esTerminal();
    }

    public boolean tieneTecnicoAsignado() {
        return tecnicoId != null;
    }

    /** Returns the pending state changes and clears them (no transition is missed). */
    public List<CambioEstado> drenarCambiosPendientes() {
        List<CambioEstado> copia = List.copyOf(cambiosPendientes);
        cambiosPendientes.clear();
        return copia;
    }

    private void registrarCambio(EstadoOt origen, EstadoOt destino, ActorOt actor, Instant ahora, String motivo) {
        cambiosPendientes.add(new CambioEstado(origen, destino, actor, ahora, motivo));
    }

    public OtId getId() {
        return id;
    }

    public ClienteId getClienteId() {
        return clienteId;
    }

    public TecnicoId getTecnicoId() {
        return tecnicoId;
    }

    public CategoriaServicio getCategoriaServicio() {
        return categoriaServicio;
    }

    public String getDescripcionFalla() {
        return descripcionFalla;
    }

    public List<String> getEvidenciaUrls() {
        return Collections.unmodifiableList(evidenciaUrls);
    }

    public String getDireccion() {
        return direccion;
    }

    public Point getUbicacion() {
        return ubicacion;
    }

    public EstadoOt getEstado() {
        return estado;
    }

    public double getRadioKm() {
        return radioKm;
    }

    public Instant getVentanaExpiraEn() {
        return ventanaExpiraEn;
    }

    public Instant getCreadaEn() {
        return creadaEn;
    }

    public Instant getAsignadaEn() {
        return asignadaEn;
    }

    public Instant getFinalizadaEn() {
        return finalizadaEn;
    }

    public ActorOt getCanceladaPor() {
        return canceladaPor;
    }

    public MotivoCancelacion getMotivoCancelacion() {
        return motivoCancelacion;
    }

    public BigDecimal getTarifaVisita() {
        return tarifaVisita;
    }

    public Double getDistanciaKm() {
        return distanciaKm;
    }

    public TarifaFuente getTarifaFuente() {
        return tarifaFuente;
    }

    public Diagnostico getDiagnostico() {
        return diagnostico;
    }

    public Presupuesto getPresupuesto() {
        return presupuesto;
    }
}
