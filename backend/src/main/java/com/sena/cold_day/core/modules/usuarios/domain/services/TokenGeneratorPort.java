package com.sena.cold_day.core.modules.usuarios.domain.services;

/**
 * Port that produces opaque, high-entropy reset tokens and the one-way hash
 * stored at rest. The domain never sees the plaintext token after emission.
 */
public interface TokenGeneratorPort {

    /** Generates a fresh, cryptographically random token (32 bytes, Base64URL). */
    String generar();

    /** One-way hash of a token for at-rest storage (SHA-256, lowercase hex). */
    String hash(String token);
}
