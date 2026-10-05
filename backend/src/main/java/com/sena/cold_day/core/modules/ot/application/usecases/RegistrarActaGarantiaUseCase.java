package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoVerificacionActa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Records the warranty acta signed by the client (Ley 1480, 90 days).
 *
 * <p>The verification code is generated HERE, on the server, and never derived
 * from the order id: that id is the API path of the order, so a code built from
 * it is reproducible by any caller and would only look authentic. The client
 * sends ink, it does not get to choose the seal.
 *
 * <p>Ownership is checked in the use case, as in {@link CalificarOtUseCase} and
 * {@link PagarVisitaUseCase}: a principal resolves to a client profile, and only
 * the client that owns the order may sign its acta. The transport repeats the
 * check through {@code AutorizacionPropietario}, but the rule is not a
 * transport concern.
 */
@Service
public class RegistrarActaGarantiaUseCase {

    private final ClienteRepository clienteRepository;
    private final OtRepository otRepository;
    private final Clock clock;

    public RegistrarActaGarantiaUseCase(ClienteRepository clienteRepository, OtRepository otRepository, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.otRepository = otRepository;
        this.clock = clock;
    }

    /**
     * @return the server-issued verification code and the signing instant, the
     *         only values the UI may present as proof that the acta exists.
     */
    @Transactional
    public ActaGarantiaResult registrar(UsuarioId usuarioId, OtId otId, String firmaDataUrl) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        CodigoVerificacionActa codigo = CodigoVerificacionActa.generar();
        ot.registrarActaGarantia(firmaDataUrl, codigo, clock.instant());
        Ot persisted = otRepository.save(ot);
        return new ActaGarantiaResult(persisted.getId(), persisted.getActaCodigoVerificacion().valor(),
                persisted.getActaFirmadaEn());
    }

    /**
     * Outcome of signing the acta. It carries the code read back from the
     * persisted aggregate, not the value passed in, so the response can only
     * ever describe what was actually stored.
     */
    public record ActaGarantiaResult(OtId otId, String codigoVerificacion, Instant firmadaEn) {
    }
}
