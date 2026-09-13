package com.sena.cold_day.core.modules.usuarios.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

/**
 * Pure unit test for the reset-token generator. No Spring, no DB.
 * Contract: 32 random bytes rendered as Base64URL without padding (43 chars),
 * hashed at rest with SHA-256 lowercase hex (64 chars).
 */
class TokenGeneratorTest {

    private final SecureRandomTokenGenerator generator = new SecureRandomTokenGenerator();

    @Test
    void generatesBase64UrlTokenWith256BitsOfEntropy() {
        String token = generator.generar();

        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]{43}");
    }

    @Test
    void generatesDistinctTokensOnEveryCall() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            tokens.add(generator.generar());
        }

        assertThat(tokens).hasSize(100);
    }

    @Test
    void hashesWithSha256LowercaseHex() {
        // NIST SHA-256 test vector for the ASCII string "abc".
        assertThat(generator.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void hashingIsDeterministicAndTokenSpecific() {
        String token = generator.generar();

        assertThat(generator.hash(token)).hasSize(64).isEqualTo(generator.hash(token));
        assertThat(generator.hash(token)).isNotEqualTo(generator.hash(generator.generar()));
    }
}
