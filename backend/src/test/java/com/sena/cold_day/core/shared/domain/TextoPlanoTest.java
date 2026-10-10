package com.sena.cold_day.core.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for the pure {@link TextoPlano} normalizer. No Spring, no Docker:
 * the class under test has no framework dependency, so these run everywhere.
 */
class TextoPlanoTest {

    @Test
    void nullStaysNull() {
        assertThat(TextoPlano.limpiar(null)).isNull();
    }

    @Test
    void trimsLeadingAndTrailingWhitespace() {
        assertThat(TextoPlano.limpiar("   hola mundo   ")).isEqualTo("hola mundo");
        assertThat(TextoPlano.limpiar("\t\n hola \n\t")).isEqualTo("hola");
    }

    @Test
    void collapsesInternalWhitespaceRunsToASingleSpace() {
        assertThat(TextoPlano.limpiar("hola    mundo")).isEqualTo("hola mundo");
        assertThat(TextoPlano.limpiar("a\t\tb")).isEqualTo("a b");
        assertThat(TextoPlano.limpiar("a \n  b")).isEqualTo("a b");
    }

    @Test
    void removesIsoControlCharacters() {
        // Non-whitespace controls carry no visible meaning: removed outright.
        assertThat(TextoPlano.limpiar("ab\u0000cd")).isEqualTo("abcd");
        assertThat(TextoPlano.limpiar("\u0007hola\u0007")).isEqualTo("hola");
        assertThat(TextoPlano.limpiar("a\u001Bb")).isEqualTo("ab");

        // The separator controls (\u001C-\u001F) are Java whitespace: they collapse
        // to a single space instead of being deleted.
        assertThat(TextoPlano.limpiar("a\u001Fb")).isEqualTo("a b");
    }

    @Test
    void keepsVisibleContentUntouched() {
        assertThat(TextoPlano.limpiar("José Pérez")).isEqualTo("José Pérez");
        assertThat(TextoPlano.limpiar("ana@example.com")).isEqualTo("ana@example.com");
    }

    @Test
    void emptyAndWhitespaceOnlyBecomeEmpty() {
        assertThat(TextoPlano.limpiar("")).isEmpty();
        assertThat(TextoPlano.limpiar("   ")).isEmpty();
        assertThat(TextoPlano.limpiar("\u0000\u0007")).isEmpty();
    }

    @Test
    void limpiarCadaMapsEveryElementAndPreservesNullSemantics() {
        assertThat(TextoPlano.limpiarCada(null)).isNull();

        List<String> entrada = Arrays.asList("  a  ", null, "b   c", "\u0000x");
        assertThat(TextoPlano.limpiarCada(entrada))
                .containsExactly("a", null, "b c", "x");
    }
}
