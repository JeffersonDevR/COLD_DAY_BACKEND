package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.util.regex.Pattern;

/**
 * Human-readable code of a work order, {@code OT-YYYY-####}: the UTC year of
 * creation plus the zero-padded per-year sequence (e.g. {@code OT-2026-0007}).
 *
 * <p>The order UUID stays the API identity ({@code GET /api/ot/{id}}); this code
 * exists so a client, a technician or an administrator can name an order with
 * something a human can read, write down or say over the phone.
 *
 * <p>Allocation: the application derives the number as the highest one already
 * issued for that year plus one, inside the creation transaction (see
 * {@code OtRepository#ultimoNumeroCodigo}), and {@code idx_ot_codigo} makes the
 * code unique in the base. Two consequences are deliberate: the padding never
 * wraps — the 10000th order of a year is {@code OT-2026-10000}, which is why the
 * column holds 20 characters — and the year is taken from the same instant that
 * stamps {@code creadaEn}, so a code and its order always agree on the year.
 *
 * <p>The code is assigned once, at creation, and never regenerated:
 * {@code Ot#asignarCodigo} rejects a second assignment.
 */
public record CodigoOt(String valor) {

    /** {@code OT-} + four digits of year + {@code -} + at least four digits of sequence. */
    private static final Pattern FORMATO = Pattern.compile("^OT-\\d{4}-\\d{4,}$");

    public CodigoOt {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("El codigo de la OT es requerido");
        }
        if (!FORMATO.matcher(valor).matches()) {
            throw new IllegalArgumentException(
                    "El codigo de la OT debe tener el formato OT-YYYY-####, recibido: " + valor);
        }
    }

    /**
     * Renders a code for the given year and sequence. The caller passes the UTC
     * year of the creation instant, so allocation and the V14 backfill (which
     * partitions {@code creada_en} with {@code AT TIME ZONE 'UTC'}) agree.
     *
     * @throws IllegalArgumentException if {@code secuencia} is below one (the
     *         sequence counts issued codes, it has no zero)
     */
    public static CodigoOt formatear(int anio, int secuencia) {
        if (secuencia < 1) {
            throw new IllegalArgumentException("La secuencia del codigo de la OT empieza en 1, recibido: "
                    + secuencia);
        }
        return new CodigoOt("OT-%04d-%04d".formatted(anio, secuencia));
    }

    /** Reconstitutes a code read from persistence. */
    public static CodigoOt de(String valor) {
        return new CodigoOt(valor);
    }
}
