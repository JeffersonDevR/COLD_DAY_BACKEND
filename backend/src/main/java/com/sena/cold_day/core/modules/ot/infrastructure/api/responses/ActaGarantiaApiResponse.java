package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.application.usecases.RegistrarActaGarantiaUseCase;

/**
 * What the client gets back after signing: the server-issued verification code
 * and the instant of the signature, both read from the persisted aggregate.
 *
 * <p>There is no "descarga" here and there is no PDF. The signature itself is
 * not echoed: it can reach ~1 MB and the client already holds the exact bytes it
 * drew. A printable acta is still missing, and pretending otherwise in the
 * response would repeat the bug this endpoint exists to remove.
 */
public record ActaGarantiaApiResponse(
        String otId,
        String codigoVerificacion,
        Instant firmadaEn) {

    public static ActaGarantiaApiResponse from(RegistrarActaGarantiaUseCase.ActaGarantiaResult result) {
        return new ActaGarantiaApiResponse(
                result.otId() == null ? null : result.otId().valor().toString(),
                result.codigoVerificacion(),
                result.firmadaEn());
    }
}
