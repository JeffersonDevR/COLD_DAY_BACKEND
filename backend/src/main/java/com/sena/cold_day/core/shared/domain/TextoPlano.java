package com.sena.cold_day.core.shared.domain;

import java.util.List;

/**
 * Pure text normalization for the request boundary.
 *
 * <p>Framework-free on purpose: it lives in the shared domain layer and has no
 * Spring or persistence imports, so request records can normalize user text in
 * their compact constructors without dragging infrastructure into the model.
 *
 * <p>The rules are deliberately conservative — trim the ends, collapse internal
 * whitespace runs into a single space, and drop ISO control characters (the
 * invisible bytes an attacker or a paste can smuggle into otherwise valid
 * text). It never rewrites the visible content, so it is safe for names,
 * addresses, e-mails and free-text fields, but it must never be applied to
 * opaque secrets such as passwords, reset tokens or base64 signatures.
 */
public final class TextoPlano {

    private TextoPlano() {
    }

    /**
     * Returns {@code null} for {@code null}; otherwise trims, collapses internal
     * whitespace runs into a single space and removes ISO control characters.
     *
     * <p>Whitespace (space, tab, newline, ...) acts as a word separator and
     * collapses into one space. Non-whitespace control characters (NUL, BEL,
     * ...) carry no visible meaning and are removed instead of replaced.
     */
    public static String limpiar(String valor) {
        if (valor == null) {
            return null;
        }
        StringBuilder limpio = new StringBuilder(valor.length());
        boolean espacioPendiente = false;
        for (int i = 0; i < valor.length(); i++) {
            char actual = valor.charAt(i);
            if (Character.isWhitespace(actual)) {
                // A separator is only meaningful between two visible tokens:
                // leading whitespace is trimmed by construction.
                espacioPendiente = limpio.length() > 0;
                continue;
            }
            if (Character.isISOControl(actual)) {
                continue;
            }
            if (espacioPendiente) {
                limpio.append(' ');
                espacioPendiente = false;
            }
            limpio.append(actual);
        }
        return limpio.toString();
    }

    /**
     * Applies {@link #limpiar(String)} to every element of a text collection,
     * preserving {@code null} (both the collection and its elements). A
     * {@code null} input stays {@code null}, so optional list fields keep their
     * optional semantics.
     */
    public static List<String> limpiarCada(List<String> valores) {
        if (valores == null) {
            return null;
        }
        return valores.stream().map(TextoPlano::limpiar).toList();
    }
}
