package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.Test;

/**
 * RNF-01: password hashing must use BCrypt with cost factor 12. The encoded
 * format encodes the cost in the prefix (for example {@code $2a$12$...}).
 */
class PasswordEncoderAdapterTest {

    private final PasswordEncoderAdapter encoder = new PasswordEncoderAdapter();

    @Test
    void hashesWithBcryptCostFactorTwelveAndVerifiesThePassword() {
        String hash = encoder.encode("secreto");

        SoftAssertions.assertSoftly(softly -> {
            softly.assertThat(hash).startsWith("$2a$12$");
            softly.assertThat(hash).hasSize(60);
            softly.assertThat(encoder.matches("secreto", hash)).isTrue();
            softly.assertThat(encoder.matches("otra", hash)).isFalse();
        });
    }

    @Test
    void saltsMakeEachHashUniqueButStillVerifiable() {
        String first = encoder.encode("secreto");
        String second = encoder.encode("secreto");

        assertThat(first).isNotEqualTo(second);
        assertThat(encoder.matches("secreto", first)).isTrue();
        assertThat(encoder.matches("secreto", second)).isTrue();
    }
}
