package com.sena.cold_day.core.modules.ot.domain.aggregates;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.exception.CalificacionInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.exception.ConfirmarLlegadaInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.exception.PagoVisitaInvalidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.ActaInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.exception.FirmaActaInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.services.TransicionesOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoVerificacionActa;
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
    private int auxiliaresRequeridos;
    private Diagnostico diagnostico;
    private Presupuesto presupuesto;
    private Instant llegadaEn;
    private String medioPagoVisita;
    private Instant visitaPagadaEn;
    private Integer calificacionEstrellas;
    private String calificacionComentario;
    private Instant calificacionEn;
    private TecnicoId calificacionTecnicoId;
    private String actaFirmaDataUrl;
    private CodigoVerificacionActa actaCodigoVerificacion;
    private Instant actaFirmadaEn;

    /**
     * Hard ceiling on the signature payload, in characters of the data URL.
     *
     * <p>The canvas is 480x140. A hand-drawn stroke on it encodes as PNG in a
     * few kilobytes and base64 inflates it by 4/3, so a real signature lands
     * well under 64 KB. 1 MB leaves roughly an order of magnitude of headroom
     * for a dense or high-DPI capture while still bounding what a single
     * request can push into a {@code text} column: the point of the limit is
     * to refuse a payload that is not a signature, not to police legitimate
     * ink.
     */
    public static final int MAX_FIRMA_ACTA_CHARS = 1_048_576;

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

    /**
     * Reconstitution from persistence without the auxiliar count. Kept as a
     * delegating overload so every existing call site and test that rebuilds an
     * OT compiles untouched (design AD3); the count defaults to zero.
     */
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto, Double distanciaKm, TarifaFuente tarifaFuente) {
        return reconstituir(id, clienteId, tecnicoId, categoriaServicio, descripcionFalla, evidenciaUrls,
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita, diagnostico, presupuesto, distanciaKm,
                tarifaFuente, 0);
    }

    /**
     * Reconstitution from persistence without the visit tracking and rating
     * state. Kept as a delegating overload so every existing call site and test
     * that rebuilds an OT compiles untouched; the seven new fields default to
     * null.
     */
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto, Double distanciaKm, TarifaFuente tarifaFuente,
            Integer auxiliaresRequeridos) {
        return reconstituir(id, clienteId, tecnicoId, categoriaServicio, descripcionFalla, evidenciaUrls,
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita, diagnostico, presupuesto, distanciaKm,
                tarifaFuente, auxiliaresRequeridos, null, null, null, null, null, null, null);
    }

    /** Reconstitution from persistence. */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado (29 campos). Un Builder ocultaria el mapeo 1:1 con la entidad JPA.
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto, Double distanciaKm, TarifaFuente tarifaFuente,
            Integer auxiliaresRequeridos, Instant llegadaEn, String medioPagoVisita, Instant visitaPagadaEn,
            Integer calificacionEstrellas, String calificacionComentario, Instant calificacionEn,
            TecnicoId calificacionTecnicoId) {
        return reconstituir(id, clienteId, tecnicoId, categoriaServicio, descripcionFalla, evidenciaUrls,
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita, diagnostico, presupuesto, distanciaKm,
                tarifaFuente, auxiliaresRequeridos, llegadaEn, medioPagoVisita, visitaPagadaEn,
                calificacionEstrellas, calificacionComentario, calificacionEn, calificacionTecnicoId,
                null, null, null);
    }

    /**
     * Reconstitution from persistence including the signed warranty acta (V11).
     * Kept as its own overload so every existing call site and test that rebuilds
     * an OT compiles untouched; the three acta fields default to null, which is
     * exactly what an order finalized before this feature reads back as.
     */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: el estado completo del agregado (32 campos). Mismo motivo que la sobrecarga de 29 campos.
    public static Ot reconstituir(OtId id, ClienteId clienteId, TecnicoId tecnicoId,
            CategoriaServicio categoriaServicio, String descripcionFalla, List<String> evidenciaUrls,
            String direccion, Point ubicacion, EstadoOt estado, double radioKm, Instant ventanaExpiraEn,
            Instant creadaEn, Instant asignadaEn, Instant finalizadaEn, ActorOt canceladaPor,
            MotivoCancelacion motivoCancelacion, BigDecimal tarifaVisita, Diagnostico diagnostico,
            Presupuesto presupuesto, Double distanciaKm, TarifaFuente tarifaFuente,
            Integer auxiliaresRequeridos, Instant llegadaEn, String medioPagoVisita, Instant visitaPagadaEn,
            Integer calificacionEstrellas, String calificacionComentario, Instant calificacionEn,
            TecnicoId calificacionTecnicoId, String actaFirmaDataUrl, String actaCodigoVerificacion,
            Instant actaFirmadaEn) {
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
        // A row predating the auxiliar column reads back as NULL; map it to zero
        // so the count is always non-null at the API boundary (design AD2/AD3).
        ot.auxiliaresRequeridos = auxiliaresRequeridos == null ? 0 : auxiliaresRequeridos;
        ot.diagnostico = diagnostico;
        ot.presupuesto = presupuesto;
        ot.llegadaEn = llegadaEn;
        ot.medioPagoVisita = medioPagoVisita;
        ot.visitaPagadaEn = visitaPagadaEn;
        ot.calificacionEstrellas = calificacionEstrellas;
        ot.calificacionComentario = calificacionComentario;
        ot.calificacionEn = calificacionEn;
        ot.calificacionTecnicoId = calificacionTecnicoId;
        ot.actaFirmaDataUrl = actaFirmaDataUrl;
        ot.actaCodigoVerificacion = actaCodigoVerificacion == null ? null
                : CodigoVerificacionActa.de(actaCodigoVerificacion);
        ot.actaFirmadaEn = actaFirmadaEn;
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

    /** Declared auxiliares count; zero for every OT accepted without auxiliares. */
    public int getAuxiliaresRequeridos() {
        return auxiliaresRequeridos;
    }

    public Diagnostico getDiagnostico() {
        return diagnostico;
    }

    public Presupuesto getPresupuesto() {
        return presupuesto;
    }

    public Instant getLlegadaEn() {
        return llegadaEn;
    }

    public String getMedioPagoVisita() {
        return medioPagoVisita;
    }

    public Instant getVisitaPagadaEn() {
        return visitaPagadaEn;
    }

    public Integer getCalificacionEstrellas() {
        return calificacionEstrellas;
    }

    public String getCalificacionComentario() {
        return calificacionComentario;
    }

    public Instant getCalificacionEn() {
        return calificacionEn;
    }

    /** Technician that actually served the order when it was rated (RF-F1-15). */
    public TecnicoId getCalificacionTecnicoId() {
        return calificacionTecnicoId;
    }

    /**
     * RF-F1-14: el tecnico asignado confirma su llegada al sitio. Es un HECHO,
     * no una transicion: la maquina de estados de SRS 5.2 no tiene un estado
     * EN_LLEGADO, por eso el metodo no cambia {@code estado} ni genera entrada
     * en {@code ot_estado_historial}.
     *
     * <p>Es idempotente: si la llegada ya fue confirmada se devuelve sin
     * sobrescribir el instante original, para que un reintento del cliente no
     * falsifique la hora real de llegada.
     */
    public void confirmarLlegada(ActorOt actor, Instant ahora) {
        if (actor == null) {
            throw new IllegalArgumentException("El actor de la confirmacion de llegada es requerido");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de la confirmacion de llegada es requerido");
        }
        if (this.llegadaEn != null) {
            return;
        }
        if (this.estado != EstadoOt.EN_CAMINO) {
            throw new ConfirmarLlegadaInvalidaException(
                    "Solo se puede confirmar la llegada en EN_CAMINO, estado actual: " + this.estado);
        }
        if (!tieneTecnicoAsignado()) {
            throw new ConfirmarLlegadaInvalidaException(
                    "No se puede confirmar la llegada sin un tecnico asignado");
        }
        this.llegadaEn = ahora;
    }

    /**
     * RF-F1-26: registra el medio de pago de la tarifa de visita. El PAGADOR
     * es el CLIENTE (el caso de uso resuelve el perfil del cliente y valida
     * que sea dueno de la OT), por eso este metodo NO congela ningun snapshot
     * del tecnico: el pago no se atribuye a nadie, se atribuye a la orden.
     *
     * <p>El cobro no es idempotente a proposito: una segunda llamada
     * significa un doble cobro y debe rechazarse.
     */
    public void registrarPagoVisita(String medioPago, Instant ahora) {
        if (ahora == null) {
            throw new IllegalArgumentException("El momento del pago de la visita es requerido");
        }
        if (medioPago == null || medioPago.isBlank()) {
            throw new PagoVisitaInvalidoException("El medio de pago de la visita es requerido");
        }
        if (this.visitaPagadaEn != null) {
            throw new PagoVisitaInvalidoException("La visita ya fue pagada, no se permite un doble cobro");
        }
        this.medioPagoVisita = medioPago;
        this.visitaPagadaEn = ahora;
    }

    /**
     * RF-F1-15: el cliente califica al TECNICO con escala de 1 a 5 estrellas y
     * comentario cualitativo, recalculando su reputacion publica. Solo aplica
     * sobre una OT FINALIZADA y una sola vez.
     *
     * <p>La calificacion es sobre una persona, no sobre la orden, por eso se
     * congela el tecnico calificado: si la OT se reasigna despues, la
     * calificacion sigue apuntando a quien recibio el trabajo.
     */
    public void calificar(int estrellas, String comentario, Instant ahora) {
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de la calificacion es requerido");
        }
        if (this.estado != EstadoOt.FINALIZADA) {
            throw new CalificacionInvalidaException(
                    "Solo se puede calificar una OT FINALIZADA, estado actual: " + this.estado);
        }
        if (estrellas < 1 || estrellas > 5) {
            throw new CalificacionInvalidaException(
                    "La calificacion debe estar entre 1 y 5 estrellas, recibido: " + estrellas);
        }
        if (!tieneTecnicoAsignado()) {
            throw new CalificacionInvalidaException(
                    "No se puede calificar a un tecnico si nadie atendio la orden");
        }
        if (this.calificacionEstrellas != null) {
            throw new CalificacionInvalidaException("La OT ya fue calificada, no se admite una segunda calificacion");
        }
        this.calificacionEstrellas = estrellas;
        this.calificacionComentario = comentario == null || comentario.isBlank() ? null : comentario;
        this.calificacionEn = ahora;
        this.calificacionTecnicoId = this.tecnicoId;
    }

    /**
     * Records the warranty acta signed by the client on a FINALIZADA order.
     *
     * <p>This is the operation the payment page used to fake: it drew a
     * signature on a canvas, toasted "Acta Generada" and dropped the ink. Under
     * Ley 1480 that document is the consumer's proof of 90 days of warranty, so
     * the signature and the verification code now live on the aggregate, are
     * persisted with the order, and are the only thing the UI is allowed to
     * report.
     *
     * <p>Two invariants live here rather than in the controller:
     * <ul>
     *   <li>the OT must be FINALIZADA, because an acta certifying a service
     *       that was never delivered certifies nothing;</li>
     *   <li>it is signed once. A second signature is a conflict, not an update:
     *       re-signing would silently replace the document the client is
     *       holding and invalidate the code already printed on it.</li>
     * </ul>
     * The code is passed IN, generated by the application layer with
     * {@link CodigoVerificacionActa#generar()}. The aggregate never derives it
     * from its own id: that id is the API path of the order, so a code built
     * from it would be reproducible by anyone.
     *
     * <p>Like {@link #calificar}, this is a fact about a terminal order, not a
     * transition, so it produces no entry in {@code ot_estado_historial} and
     * does not touch the state machine.
     */
    public void registrarActaGarantia(String firmaDataUrl, CodigoVerificacionActa codigo, Instant ahora) {
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de la firma del acta es requerido");
        }
        if (this.estado != EstadoOt.FINALIZADA) {
            throw new ActaInvalidaException(
                    "Solo se puede firmar el acta de una OT FINALIZADA, estado actual: " + this.estado);
        }
        if (this.actaFirmadaEn != null) {
            throw new ActaInvalidaException("El acta de esta OT ya fue firmada, no se admite una segunda firma");
        }
        if (firmaDataUrl == null || firmaDataUrl.isBlank()) {
            throw new FirmaActaInvalidaException("La firma del acta es requerida");
        }
        if (firmaDataUrl.length() > MAX_FIRMA_ACTA_CHARS) {
            throw new FirmaActaInvalidaException("La firma del acta excede el tamano maximo admitido ("
                    + MAX_FIRMA_ACTA_CHARS + " caracteres)");
        }
        if (codigo == null) {
            throw new IllegalArgumentException("El codigo de verificacion del acta es requerido");
        }
        this.actaFirmaDataUrl = firmaDataUrl;
        this.actaCodigoVerificacion = codigo;
        this.actaFirmadaEn = ahora;
    }

    /** True once the warranty acta has been signed; there is no unsigned state after this. */
    public boolean actaFirmada() {
        return this.actaFirmadaEn != null;
    }

    public String getActaFirmaDataUrl() {
        return actaFirmaDataUrl;
    }

    public CodigoVerificacionActa getActaCodigoVerificacion() {
        return actaCodigoVerificacion;
    }

    public Instant getActaFirmadaEn() {
        return actaFirmadaEn;
    }
}
