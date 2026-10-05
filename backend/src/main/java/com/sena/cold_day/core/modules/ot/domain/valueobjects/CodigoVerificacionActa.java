package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Verification code of a signed warranty acta.
 *
 * <p>Emitted server-side from {@link SecureRandom}: 8 bytes rendered as 16
 * uppercase hex characters, prefixed with {@code CD-ACT-}. The order id is
 * deliberately NOT part of it. The OT id is the path segment of
 * {@code GET /api/ot/{id}}, so any client can read it; a code computed from it
 * would be reproducible by anyone and would prove nothing, it would only look
 * authentic. 64 bits of entropy is far beyond guessing and keeps the code
 * short enough to read over the phone.
 *
 * <p>The prefix carries no information beyond "this is a warranty acta"; the
 * randomness is entirely in the suffix, which is also what the partial unique
 * index on {@code ot.acta_codigo_verificacion} protects.
 */
public record CodigoVerificacionActa(String valor) {

    private static final String PREFIJO = "CD-ACT-";
    private static final int BYTES_ALEATORIOS = 8;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of().withUpperCase();

    public CodigoVerificacionActa {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("El codigo de verificacion es requerido");
        }
    }

    /** Generates a fresh code from the platform CSPRNG. */
    public static CodigoVerificacionActa generar() {
        byte[] bytes = new byte[BYTES_ALEATORIOS];
        RANDOM.nextBytes(bytes);
        return new CodigoVerificacionActa(PREFIJO + HEX.formatHex(bytes));
    }

    public static CodigoVerificacionActa de(String valor) {
        return new CodigoVerificacionActa(valor);
    }
}
