package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;

import com.sena.cold_day.core.modules.proveedores.application.usecases.AceptarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.EntregarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ExpirarInsumosUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataOfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataRequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;

/**
 * Integration proof of the insumo dispatch flows against the real H2 schema and
 * the slice-9 persistence (spec disp.R1/R3/R6/R7, design flow (b)).
 *
 * <p>At this slice the dispatch use cases exist but no REST controller does, so
 * this IT exercises the application layer directly: broadcast, atomic
 * first-to-accept with sibling invalidation, delivery, the inactive-supplier
 * gate, zero eligible suppliers and the expiry sweep. Slice 11 extends this class
 * with the HTTP/controller subset once {@code InsumoController} lands.
 */
@SpringBootTest
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(InsumoApiIT.RelojFijo.class)
class InsumoApiIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

    @TestConfiguration
    static class RelojFijo {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }
    }

    @Autowired SolicitarInsumoUseCase solicitar;
    @Autowired AceptarInsumoUseCase aceptar;
    @Autowired EntregarInsumoUseCase entregar;
    @Autowired ExpirarInsumosUseCase expirar;
    @Autowired RequerimientoInsumoRepository requerimientos;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired ProveedorRepository proveedores;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;
    @Autowired SpringDataProveedorRepository springDataProveedores;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
        springDataProveedores.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void broadcastThenFirstAcceptThenDeliveryCompletesTheRequest() {
        Proveedor primero = crearProveedorActivo("900-1", "prov.1@example.com");
        Proveedor segundo = crearProveedorActivo("900-2", "prov.2@example.com");
        crearProveedorInactivo("900-3", "prov.3@example.com");

        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, "Compresor ruidoso").orElseThrow();
        assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);

        // AD7: only the two active suppliers receive an offer.
        List<OfertaInsumo> pendientes = ofertas.listarPendientesPorRequerimiento(req.getId());
        assertThat(pendientes).hasSize(2);

        OfertaInsumo dePrimero = ofertaDe(pendientes, primero.getId());
        RequerimientoInsumo asignado = aceptar.aceptar(new UsuarioId(primero.getUsuarioId()), dePrimero.getId());

        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        assertThat(ofertas.buscarPorId(dePrimero.getId())).hasValueSatisfying(
                oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.ACEPTADA));
        assertThat(ofertas.buscarPorId(ofertaDe(pendientes, segundo.getId()).getId())).hasValueSatisfying(
                oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));

        RequerimientoInsumo entregado = entregar.entregar(new UsuarioId(primero.getUsuarioId()), req.getId());
        assertThat(entregado.getEstado()).isEqualTo(EstadoRequerimiento.ENTREGADO);
        assertThat(entregado.getResueltaEn()).isEqualTo(AHORA);
    }

    @Test
    void anInactiveSupplierCannotAcceptAndLeavesTheRequestUntouched() {
        crearProveedorActivo("900-4", "prov.4@example.com");
        Proveedor inactivo = crearProveedorInactivo("900-5", "prov.5@example.com");

        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo delInactivo = ofertas.save(
                OfertaInsumo.crear(req.getId(), inactivo.getId(), AHORA, EXPIRA));

        assertThatThrownBy(() -> aceptar.aceptar(new UsuarioId(inactivo.getUsuarioId()), delInactivo.getId()))
                .isInstanceOf(ProveedorNoElegibleException.class);

        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
        assertThat(ofertas.buscarPorId(delInactivo.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE));
    }

    @Test
    void zeroEligibleSuppliersResolveToSinProveedorWithoutBlockingTheOt() {
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();

        assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
        assertThat(ofertas.listarPendientesPorRequerimiento(req.getId())).isEmpty();
        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR));
    }

    @Test
    void theExpirySweepClosesPendingOffersAndResolvesOpenRequests() {
        RequerimientoInsumo vencido = requerimientos.save(RequerimientoInsumo.crear(OT_ID, TECNICO_ID, LINEAS,
                null, AHORA.minusSeconds(10), AHORA.minusSeconds(1)));
        OfertaInsumo ofertaVencida = ofertas.save(OfertaInsumo.crear(vencido.getId(), ProveedorId.nueva(),
                AHORA.minusSeconds(10), AHORA.minusSeconds(1)));
        RequerimientoInsumo vigente = requerimientos.save(RequerimientoInsumo.crear(OT_ID, TECNICO_ID, LINEAS,
                null, AHORA, EXPIRA));
        ofertas.save(OfertaInsumo.crear(vigente.getId(), ProveedorId.nueva(), AHORA, EXPIRA));

        ExpirarInsumosUseCase.Resultado resultado = expirar.expirar();

        assertThat(resultado.ofertasExpiradas()).isEqualTo(1);
        assertThat(resultado.requerimientosSinProveedor()).isEqualTo(1);
        assertThat(ofertas.buscarPorId(ofertaVencida.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA));
        assertThat(requerimientos.buscarPorId(vencido.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR));
        assertThat(requerimientos.buscarPorId(vigente.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
    }

    private Proveedor crearProveedorActivo(String nit, String correo) {
        return proveedores.save(Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of()));
    }

    private Proveedor crearProveedorInactivo(String nit, String correo) {
        Proveedor proveedor = Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of());
        proveedor.desactivar();
        return proveedores.save(proveedor);
    }

    private Long crearUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String password) {
                return "fake:" + password;
            }

            public boolean matches(String password, String hash) {
                return ("fake:" + password).equals(hash);
            }
        };
        Usuario usuario = Usuario.registrar("Proveedor", correo, "secreto", null, null, Rol.PROVEEDOR, true,
                encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private OfertaInsumo ofertaDe(List<OfertaInsumo> pendientes, ProveedorId proveedorId) {
        return pendientes.stream().filter(oferta -> oferta.getProveedorId().equals(proveedorId)).findFirst()
                .orElseThrow();
    }
}
