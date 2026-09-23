package com.sena.cold_day.core.modules.administracion.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.exception.AdministracionConflictoException;
import com.sena.cold_day.core.modules.administracion.domain.exception.DisputaNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.exception.LiquidacionNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.repository.DisputaRepository;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Use-case coverage for the administracion module (CU-12/13/15, RF-F1-22/23/24/25/26):
 * settlement registration, receipt verification, dispute mediation and the admin
 * dashboard.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdministracionUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(AHORA, ZoneOffset.UTC);
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock UsuarioRepository usuarioRepository;
    @Mock LiquidacionRepository liquidacionRepository;
    @Mock DisputaRepository disputaRepository;
    @Mock ApplicationEventPublisher events;

    private RegistrarPagoUseCase registrarPago;
    private CargarComprobanteUseCase cargarComprobante;
    private VerificarComprobanteUseCase verificarComprobante;
    private GestionarDisputaUseCase gestionarDisputa;
    private ConsultarMetricasAdminUseCase metricas;
    private ListarLiquidacionesTecnicoUseCase listarLiquidaciones;

    @BeforeEach
    void setUp() {
        registrarPago = new RegistrarPagoUseCase(otRepository, tecnicoRepository, liquidacionRepository,
                events, CLOCK, new BigDecimal("0.15"));
        cargarComprobante = new CargarComprobanteUseCase(liquidacionRepository, tecnicoRepository, events);
        verificarComprobante = new VerificarComprobanteUseCase(liquidacionRepository, tecnicoRepository,
                usuarioRepository, events, CLOCK);
        gestionarDisputa = new GestionarDisputaUseCase(otRepository, clienteRepository, tecnicoRepository,
                disputaRepository, usuarioRepository, events, CLOCK);
        metricas = new ConsultarMetricasAdminUseCase(otRepository, tecnicoRepository, disputaRepository,
                liquidacionRepository);
        listarLiquidaciones = new ListarLiquidacionesTecnicoUseCase(liquidacionRepository, tecnicoRepository,
                usuarioRepository);
    }

    // ------------------------------------------------------------------ RegistrarPago

    @Test
    void registrarPagoComputesCommissionAndBlocksTheTecnico() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.DISPONIBLE);
        Ot ot = ot(EstadoOt.FINALIZADA, tecnico.getId(), OtId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.buscarPorOt(ot.getId())).thenReturn(Optional.empty());
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));

        var response = registrarPago.registrar(PRINCIPAL, ot.getId(), new BigDecimal("200000.00"),
                MedioPago.EFECTIVO);

        assertThat(response.valorComision()).isEqualByComparingTo("30000.00");
        assertThat(response.estado()).isEqualTo(EstadoLiquidacion.PENDIENTE_CONSIGNACION);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        verify(tecnicoRepository).save(tecnico);
        verify(events).publishEvent(any(Object.class));
    }

    @Test
    void registrarPagoRejectsNonFinalizadaOrder() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.OCUPADO);
        Ot ot = ot(EstadoOt.EN_REPARACION, tecnico.getId(), OtId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));

        assertThatThrownBy(() -> registrarPago.registrar(PRINCIPAL, ot.getId(), BigDecimal.TEN,
                MedioPago.EFECTIVO)).isInstanceOf(AdministracionConflictoException.class);
    }

    @Test
    void registrarPagoRejectsUnknownOrderAndMissingOrForeignTecnico() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> registrarPago.registrar(PRINCIPAL, desconocida, BigDecimal.TEN,
                MedioPago.EFECTIVO)).isInstanceOf(OtNoEncontradoException.class);

        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.DISPONIBLE);
        Ot ot = ot(EstadoOt.FINALIZADA, tecnico.getId(), OtId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> registrarPago.registrar(PRINCIPAL, ot.getId(), BigDecimal.TEN,
                MedioPago.EFECTIVO)).isInstanceOf(PerfilTecnicoNoEncontradoException.class);

        Tecnico ajeno = tecnicoAprobado(EstadoOperativo.DISPONIBLE);
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(ajeno));
        assertThatThrownBy(() -> registrarPago.registrar(PRINCIPAL, ot.getId(), BigDecimal.TEN,
                MedioPago.EFECTIVO)).isInstanceOf(TecnicoNoAsignadoException.class);
    }

    @Test
    void registrarPagoRejectsAnOrderWithAnExistingLiquidacion() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.DISPONIBLE);
        Ot ot = ot(EstadoOt.FINALIZADA, tecnico.getId(), OtId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.buscarPorOt(ot.getId())).thenReturn(Optional.of(liquidacionPendiente(tecnico.getId())));

        assertThatThrownBy(() -> registrarPago.registrar(PRINCIPAL, ot.getId(), BigDecimal.TEN,
                MedioPago.EFECTIVO)).isInstanceOf(AdministracionConflictoException.class);
    }

    // ------------------------------------------------------------------ CargarComprobante

    @Test
    void cargarComprobanteMovesTheLiquidacionToVerificacion() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionPendiente(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));

        var response = cargarComprobante.cargar(PRINCIPAL, liquidacion.getId(), "https://cdn/c.jpg");

        assertThat(response.estado()).isEqualTo(EstadoLiquidacion.EN_VERIFICACION);
        assertThat(response.comprobanteUrl()).isEqualTo("https://cdn/c.jpg");
        verify(events).publishEvent(any(Object.class));
    }

    @Test
    void cargarComprobanteRejectsUnknownLiquidacionMissingProfileAndForeignTecnico() {
        LiquidacionId desconocida = LiquidacionId.nueva();
        when(liquidacionRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cargarComprobante.cargar(PRINCIPAL, desconocida, "https://cdn/c.jpg"))
                .isInstanceOf(LiquidacionNoEncontradaException.class);

        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionPendiente(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cargarComprobante.cargar(PRINCIPAL, liquidacion.getId(), "https://cdn/c.jpg"))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);

        Tecnico ajeno = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(ajeno));
        assertThatThrownBy(() -> cargarComprobante.cargar(PRINCIPAL, liquidacion.getId(), "https://cdn/c.jpg"))
                .isInstanceOf(TecnicoNoAsignadoException.class);
    }

    // ------------------------------------------------------------------ VerificarComprobante

    @Test
    void aprobarReleasesTheTecnicoWhenNoOtherLiquidacionBlocksIt() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionEnVerificacion(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.existeBloqueadoraPara(tecnico.getId())).thenReturn(false);

        var response = verificarComprobante.aprobar(liquidacion.getId());

        assertThat(response.estado()).isEqualTo(EstadoLiquidacion.APROBADA);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);
        verify(tecnicoRepository).save(tecnico);
    }

    @Test
    void aprobarKeepsTheTecnicoBlockedWhenAnotherLiquidacionIsPending() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionEnVerificacion(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
        when(liquidacionRepository.existeBloqueadoraPara(tecnico.getId())).thenReturn(true);

        verificarComprobante.aprobar(liquidacion.getId());

        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        verify(tecnicoRepository, never()).save(any());
    }

    @Test
    void aprobarFailsWhenLiquidacionOrTecnicoIsMissing() {
        LiquidacionId desconocida = LiquidacionId.nueva();
        when(liquidacionRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> verificarComprobante.aprobar(desconocida))
                .isInstanceOf(LiquidacionNoEncontradaException.class);

        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionEnVerificacion(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> verificarComprobante.aprobar(liquidacion.getId()))
                .isInstanceOf(TecnicoNoEncontradoException.class);
    }

    @Test
    void rechazarKeepsTheTecnicoBlocked() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionEnVerificacion(tecnico.getId());
        when(liquidacionRepository.buscarPorId(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.save(any(Liquidacion.class))).thenAnswer(i -> i.getArgument(0));

        var response = verificarComprobante.rechazar(liquidacion.getId(), "Comprobante ilegible");

        assertThat(response.estado()).isEqualTo(EstadoLiquidacion.RECHAZADA);
        assertThat(response.motivoRechazo()).isEqualTo("Comprobante ilegible");
        verify(events).publishEvent(any(Object.class));
    }

    @Test
    void listarPendientesAndTodasEnrichWithTheTecnicoName() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Liquidacion liquidacion = liquidacionEnVerificacion(tecnico.getId());
        when(liquidacionRepository.buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION))
                .thenReturn(List.of(liquidacion));
        when(liquidacionRepository.listarTodas()).thenReturn(List.of(liquidacion));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
        when(usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .thenReturn(Optional.of(usuario(tecnico.getUsuarioId(), "Ana")));

        assertThat(verificarComprobante.listarPendientes().get(0).tecnicoNombre()).isEqualTo("Ana");
        assertThat(verificarComprobante.listarTodas().get(0).tecnicoNombre()).isEqualTo("Ana");
    }

    // ------------------------------------------------------------------ ListarLiquidacionesTecnico

    @Test
    void listarLiquidacionesDelTecnico() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(usuarioRepository.buscarPorId(PRINCIPAL)).thenReturn(Optional.of(usuario(USUARIO_ID, "Ana")));
        when(liquidacionRepository.buscarPorTecnico(tecnico.getId()))
                .thenReturn(List.of(liquidacionPendiente(tecnico.getId())));

        var response = listarLiquidaciones.listar(PRINCIPAL);

        assertThat(response).hasSize(1);
        assertThat(response.get(0).tecnicoNombre()).isEqualTo("Ana");
    }

    @Test
    void listarLiquidacionesFailsWithoutATecnicoProfile() {
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> listarLiquidaciones.listar(PRINCIPAL))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);
    }

    // ------------------------------------------------------------------ GestionarDisputa

    @Test
    void abrirDisputaRegistersItAndMovesTheOrderToDisputada() {
        ClienteId clienteId = ClienteId.nueva();
        Ot ot = ot(EstadoOt.EN_DIAGNOSTICO, null, clienteId, AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente(clienteId)));
        when(disputaRepository.buscarAbiertaPorOt(ot.getId())).thenReturn(Optional.empty());
        when(otRepository.save(any(Ot.class))).thenAnswer(i -> i.getArgument(0));
        when(disputaRepository.save(any(Disputa.class))).thenAnswer(i -> i.getArgument(0));

        var response = gestionarDisputa.abrir(PRINCIPAL, ot.getId(), "Trabajo incompleto");

        assertThat(response.motivo()).isEqualTo("Trabajo incompleto");
        assertThat(response.estado()).isEqualTo(EstadoDisputa.ABIERTA);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.DISPUTADA);
        verify(events).publishEvent(any(Object.class));
    }

    @Test
    void abrirDisputaRejectsUnknownOrderMissingProfileForeignClientAndDuplicate() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> gestionarDisputa.abrir(PRINCIPAL, desconocida, "motivo"))
                .isInstanceOf(OtNoEncontradoException.class);

        Ot ot = ot(EstadoOt.EN_DIAGNOSTICO, null, ClienteId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> gestionarDisputa.abrir(PRINCIPAL, ot.getId(), "motivo"))
                .isInstanceOf(ClienteNoEncontradoException.class);

        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente(ClienteId.nueva())));
        assertThatThrownBy(() -> gestionarDisputa.abrir(PRINCIPAL, ot.getId(), "motivo"))
                .isInstanceOf(OtAccesoNoPermitidoException.class);

        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente(ot.getClienteId())));
        when(disputaRepository.buscarAbiertaPorOt(ot.getId()))
                .thenReturn(Optional.of(Disputa.abrir(ot.getId(), "prev", AHORA)));
        assertThatThrownBy(() -> gestionarDisputa.abrir(PRINCIPAL, ot.getId(), "motivo"))
                .isInstanceOf(AdministracionConflictoException.class);
    }

    @Test
    void resolverConAcuerdoFinalizesTheOrderAndReleasesTheTecnico() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.OCUPADO);
        Ot ot = ot(EstadoOt.DISPUTADA, tecnico.getId(), ClienteId.nueva(), AHORA);
        Disputa disputa = Disputa.abrir(ot.getId(), "motivo", AHORA);
        when(disputaRepository.buscarPorId(disputa.getId())).thenReturn(Optional.of(disputa));
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(disputaRepository.save(any(Disputa.class))).thenAnswer(i -> i.getArgument(0));
        when(otRepository.save(any(Ot.class))).thenAnswer(i -> i.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));

        var response = gestionarDisputa.resolver(disputa.getId(), true, "Se repara sin costo");

        assertThat(response.estado()).isEqualTo(EstadoDisputa.RESUELTA_CON_ACUERDO);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
        verify(tecnicoRepository).save(tecnico);
    }

    @Test
    void resolverSinAcuerdoCancelsTheOrderWithoutCharge() {
        Ot ot = ot(EstadoOt.DISPUTADA, null, ClienteId.nueva(), AHORA);
        Disputa disputa = Disputa.abrir(ot.getId(), "motivo", AHORA);
        when(disputaRepository.buscarPorId(disputa.getId())).thenReturn(Optional.of(disputa));
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(disputaRepository.save(any(Disputa.class))).thenAnswer(i -> i.getArgument(0));
        when(otRepository.save(any(Ot.class))).thenAnswer(i -> i.getArgument(0));

        var response = gestionarDisputa.resolver(disputa.getId(), false, "Cliente no acepta");

        assertThat(response.estado()).isEqualTo(EstadoDisputa.RESUELTA_SIN_ACUERDO);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.CANCELADA);
    }

    @Test
    void resolverFailsWhenDisputaOrOrderIsMissing() {
        DisputaId desconocida = DisputaId.nueva();
        when(disputaRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> gestionarDisputa.resolver(desconocida, true, "res"))
                .isInstanceOf(DisputaNoEncontradaException.class);

        Disputa disputa = Disputa.abrir(OtId.nueva(), "motivo", AHORA);
        when(disputaRepository.buscarPorId(disputa.getId())).thenReturn(Optional.of(disputa));
        when(otRepository.buscarPorId(disputa.getOtId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> gestionarDisputa.resolver(disputa.getId(), true, "res"))
                .isInstanceOf(OtNoEncontradoException.class);
    }

    @Test
    void listarDisputasEnrichesWithClientAndTecnicoNames() {
        Tecnico tecnico = tecnicoAprobado(EstadoOperativo.OCUPADO);
        ClienteId clienteId = ClienteId.nueva();
        Ot ot = ot(EstadoOt.DISPUTADA, tecnico.getId(), clienteId, AHORA);
        Disputa disputa = Disputa.abrir(ot.getId(), "motivo", AHORA);
        when(disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA)).thenReturn(List.of(disputa));
        when(disputaRepository.listarTodas()).thenReturn(List.of(disputa));
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.buscarPorId(clienteId))
                .thenReturn(Optional.of(cliente(clienteId)));
        when(usuarioRepository.buscarPorId(new UsuarioId(cliente(clienteId).getUsuarioId().valor())))
                .thenReturn(Optional.of(usuario(cliente(clienteId).getUsuarioId().valor(), "Cliente Ana")));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
        when(usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .thenReturn(Optional.of(usuario(tecnico.getUsuarioId(), "Tecnico Luis")));

        assertThat(gestionarDisputa.listarAbiertas().get(0).clienteNombre()).isEqualTo("Cliente Ana");
        assertThat(gestionarDisputa.listarAbiertas().get(0).tecnicoNombre()).isEqualTo("Tecnico Luis");
        assertThat(gestionarDisputa.listarTodas()).hasSize(1);
    }

    // ------------------------------------------------------------------ ConsultarMetricas

    @Test
    void consultarBuildsTheDashboardFromEverySource() {
        Tecnico disponible = tecnicoAprobado(EstadoOperativo.DISPONIBLE);
        Tecnico bloqueado = tecnicoAprobado(EstadoOperativo.BLOQUEADO_POR_LIQUIDACION);
        Ot enEjecucion = ot(EstadoOt.EN_REPARACION, disponible.getId(), ClienteId.nueva(), AHORA);
        Ot finalizada = ot(EstadoOt.FINALIZADA, disponible.getId(), ClienteId.nueva(), AHORA);

        when(otRepository.buscarPorEstado(EstadoOt.EN_REPARACION)).thenReturn(List.of(enEjecucion));
        when(otRepository.buscarPorEstado(any(EstadoOt.class))).thenAnswer(inv ->
                inv.getArgument(0) == EstadoOt.EN_REPARACION ? List.of(enEjecucion) : List.of());
        when(otRepository.buscarPorEstado(EstadoOt.FINALIZADA)).thenReturn(List.of(finalizada));
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(disponible, bloqueado));
        when(disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA))
                .thenReturn(List.of(Disputa.abrir(OtId.nueva(), "m", AHORA)));
        when(liquidacionRepository.buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION))
                .thenReturn(List.of(liquidacionEnVerificacion(disponible.getId())));
        when(liquidacionRepository.listarTodas())
                .thenReturn(List.of(liquidacionAprobada(disponible.getId(), AHORA)));

        var response = metricas.consultar();

        assertThat(response.otsEnEjecucion()).isEqualTo(1);
        assertThat(response.tecnicosTotales()).isEqualTo(2);
        assertThat(response.tecnicosVerificados()).isEqualTo(2);
        assertThat(response.tecnicosBloqueadosPorLiquidacion()).isEqualTo(1);
        assertThat(response.tecnicosDisponibles()).isEqualTo(1);
        assertThat(response.disputasAbiertas()).isEqualTo(1);
        assertThat(response.liquidacionesPendientesVerificacion()).isEqualTo(1);
        assertThat(response.totalRecaudoMesCop()).isEqualByComparingTo("100000.00");
        assertThat(response.comisionesMesCop()).isEqualByComparingTo("15000.00");
        assertThat(response.distribucionCategorias()).hasSize(CategoriaServicio.values().length);
        assertThat(response.historicoSemanal()).hasSize(7);
    }

    @Test
    void consultarWithoutDataReturnsZerosAndNullAverage() {
        when(otRepository.buscarPorEstado(any(EstadoOt.class))).thenReturn(List.of());
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of());
        when(disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA)).thenReturn(List.of());
        when(liquidacionRepository.buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION)).thenReturn(List.of());
        when(liquidacionRepository.listarTodas()).thenReturn(List.of());

        var response = metricas.consultar();

        assertThat(response.otsEnEjecucion()).isZero();
        assertThat(response.tecnicosTotales()).isZero();
        assertThat(response.tiempoPromedioAsignacionSegundos()).isNull();
        assertThat(response.totalRecaudoMesCop()).isEqualByComparingTo("0");
        assertThat(response.historicoSemanal()).hasSize(7);
    }

    // ------------------------------------------------------------------ fixtures

    private Tecnico tecnicoAprobado(EstadoOperativo estado) {
        return Tecnico.reconstituir(TecnicoId.nueva(), USUARIO_ID, "1098765001",
                Set.of(CategoriaServicio.REFRIGERACION), estado, EstadoValidacion.APROBADO, null, Set.of(),
                true, new Point(7.8, -72.5), false, null);
    }

    private Cliente cliente(ClienteId clienteId) {
        return Cliente.reconstituir(clienteId, new UsuarioId(50L), TipoCliente.B2C,
                DireccionPrincipal.con("Calle 1", "Cúcuta", "Centro", null), true);
    }

    private Usuario usuario(Long id, String nombre) {
        return Usuario.reconstituir(id, nombre, "correo@example.com", "hash", "3001234567", null,
                Rol.TECNICO, java.time.LocalDateTime.now(ZoneId.systemDefault()), true, true, 0);
    }

    private Ot ot(EstadoOt estado, TecnicoId tecnicoId, ClienteId clienteId, Instant creadaEn) {
        return Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8, -72.5), estado, 10.0, null,
                creadaEn, creadaEn, estado == EstadoOt.FINALIZADA ? creadaEn : null, null, null, null,
                null, null);
    }

    private Ot ot(EstadoOt estado, TecnicoId tecnicoId, OtId otId, Instant creadaEn) {
        return Ot.reconstituir(otId, ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8, -72.5), estado, 10.0, null,
                creadaEn, creadaEn, estado == EstadoOt.FINALIZADA ? creadaEn : null, null, null, null,
                null, null);
    }

    private Liquidacion liquidacionPendiente(TecnicoId tecnicoId) {
        return Liquidacion.registrar(OtId.nueva(), tecnicoId, new BigDecimal("100000.00"),
                MedioPago.EFECTIVO, new BigDecimal("0.15"), AHORA);
    }

    private Liquidacion liquidacionEnVerificacion(TecnicoId tecnicoId) {
        Liquidacion liquidacion = liquidacionPendiente(tecnicoId);
        liquidacion.cargarComprobante("https://cdn/c.jpg");
        return liquidacion;
    }

    private Liquidacion liquidacionAprobada(TecnicoId tecnicoId, Instant creadaEn) {
        Liquidacion liquidacion = Liquidacion.reconstituir(LiquidacionId.nueva(), OtId.nueva(), tecnicoId,
                new BigDecimal("100000.00"), MedioPago.EFECTIVO, new BigDecimal("0.15"),
                new BigDecimal("15000.00"), EstadoLiquidacion.APROBADA, "https://cdn/c.jpg", null,
                creadaEn, creadaEn);
        return liquidacion;
    }
}
