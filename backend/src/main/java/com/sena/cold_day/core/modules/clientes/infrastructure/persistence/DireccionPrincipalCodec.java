package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;

import java.util.ArrayList;
import java.util.List;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Lossless, parse-safe encoding of {@link DireccionPrincipal}'s textual
 * components inside the single {@code direccion_principal} column.
 *
 * <p>Encoding: the three components ({@code calle}, {@code ciudad},
 * {@code barrio}) are joined with the {@code |} separator. A literal backslash
 * ({@code \}) is used as the escape character and is written before any {@code |}
 * or {@code \} that appears inside a component. A null barrio is encoded as an
 * empty third component and decoded back to {@code null}, preserving the
 * domain's optional-barrio semantics.
 *
 * <p>The geographic {@link Point} is NOT encoded here: it is persisted in the
 * dedicated {@code latitud}/{@code longitud} columns and reattached on decode
 * when both coordinates are present.
 */
final class DireccionPrincipalCodec {

    static final String DIRECCION_SEPARATOR = "|";
    static final char ESCAPE = '\\';

    private DireccionPrincipalCodec() {
    }

    static String encode(DireccionPrincipal direccion) {
        if (direccion == null) {
            return null;
        }
        return escape(direccion.getCalle()) + DIRECCION_SEPARATOR
                + escape(direccion.getCiudad()) + DIRECCION_SEPARATOR
                + escape(direccion.getBarrio() == null ? "" : direccion.getBarrio());
    }

    static DireccionPrincipal decode(String encoded, Double latitud, Double longitud) {
        if (encoded == null || encoded.isBlank()) {
            return null;
        }
        List<String> partes = splitUnescaped(encoded);
        if (partes.size() != 3) {
            throw new IllegalArgumentException("Direccion persistida invalida: " + encoded);
        }
        String barrio = partes.get(2).isBlank() ? null : partes.get(2);
        if (latitud != null && longitud != null) {
            return DireccionPrincipal.con(partes.get(0), partes.get(1), barrio,
                    new Point(latitud, longitud));
        }
        return DireccionPrincipal.sinUbicacion(partes.get(0), partes.get(1), barrio);
    }

    private static String escape(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == ESCAPE || c == DIRECCION_SEPARATOR.charAt(0)) {
                escaped.append(ESCAPE);
            }
            escaped.append(c);
        }
        return escaped.toString();
    }

    private static List<String> splitUnescaped(String encoded) {
        List<String> partes = new ArrayList<>(3);
        StringBuilder actual = new StringBuilder(encoded.length());
        boolean escaped = false;
        for (int i = 0; i < encoded.length(); i++) {
            char c = encoded.charAt(i);
            if (escaped) {
                actual.append(c);
                escaped = false;
            } else if (c == ESCAPE) {
                escaped = true;
            } else if (c == DIRECCION_SEPARATOR.charAt(0)) {
                partes.add(actual.toString());
                actual.setLength(0);
            } else {
                actual.append(c);
            }
        }
        if (escaped) {
            throw new IllegalArgumentException("Direccion persistida invalida: " + encoded);
        }
        partes.add(actual.toString());
        return partes;
    }
}
