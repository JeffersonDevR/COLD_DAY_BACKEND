package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCreada;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-08/RF-F1-08: an authenticated client creates an urgent OT. Creation lands
 * in {@code SOLICITADA} and immediately hands off to
 * {@link IniciarBusquedaTecnicoUseCase}, which advances to
 * {@code BUSCANDO_TECNICO} and broadcasts the first offers (design data flow).
 *
 * <p>This is the single place where the human-readable code
 * ({@link CodigoOt}, {@code OT-YYYY-####}) is allocated: el numero lo reserva un
 * contador atomico por año ({@link OtRepository#siguienteNumeroCodigo(int)}),
 * dentro de la transaccion de creacion, y el codigo se asigna al agregado antes
 * de guardarlo. Una orden llega a la tabla con codigo o no llega. El reintento
 * acotado ante colision con {@code idx_ot_codigo} se mantiene como red: si el
 * contador se desincronizara (codigos editados a mano), la creacion no se pierde.
 */
@Service
public class CrearOtUseCase {

    /** Attempts on a code collision: two creations of the same year at once. */
    private static final int INTENTOS_CODIGO = 3;

    private final ClienteRepository clienteRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final OtRepository otRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    /** One fresh transaction per attempt; see {@link #crear}. */
    private final TransactionTemplate txNueva;

    public CrearOtUseCase(ClienteRepository clienteRepository, IniciarBusquedaTecnicoUseCase iniciarBusqueda,
            OtRepository otRepository, ApplicationEventPublisher events, Clock clock,
            PlatformTransactionManager txManager) {
        this.clienteRepository = clienteRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.otRepository = otRepository;
        this.events = events;
        this.clock = clock;
        this.txNueva = new TransactionTemplate(txManager);
        // REQUIRES_NEW, not REQUIRED: a retry that joins the transaction that just
        // failed is doomed, the unique index already marked it rollback-only.
        this.txNueva.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Creates the order with a freshly allocated code, retrying on a code
     * collision. The retry never runs inside the failed transaction: the unique
     * index leaves it rollback-only, so each attempt needs its own boundary.
     *
     * @throws DataIntegrityViolationException if every attempt collides
     */
    public OtResponse crear(OtRequest request, UsuarioId usuarioId) {
        for (int intento = 1; ; intento++) {
            try {
                return txNueva.execute(status -> crearEnTransaccion(request, usuarioId));
            } catch (DataIntegrityViolationException ex) {
                if (intento >= INTENTOS_CODIGO) {
                    throw ex;
                }
            }
        }
    }

    private OtResponse crearEnTransaccion(OtRequest request, UsuarioId usuarioId) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));

        Instant ahora = clock.instant();
        Ot ot = Ot.crear(cliente.getId(), request.categoriaServicio(), request.descripcionFalla(),
                request.evidenciaUrls(), request.direccion(), request.ubicacion(), ahora);
        // Allocated after the aggregate exists (a rejected request must not burn a
        // number) and before it is saved (the first save happens inside iniciar), so
        // the code travels in the INSERT that creates the order. The year is read
        // from `ahora`, the instant that also stamps creadaEn, so a code can never
        // disagree with the year of the order it belongs to.
        int anio = Year.from(ahora.atZone(ZoneOffset.UTC)).getValue();
        ot.asignarCodigo(CodigoOt.formatear(anio, otRepository.siguienteNumeroCodigo(anio)));
        Ot saved = iniciarBusqueda.iniciar(ot);
        events.publishEvent(new OtCreada(saved.getId(), cliente.getId()));
        return OtResponse.fromDomain(saved);
    }
}
