package com.sena.cold_day.core.modules.usuarios.domain.services;

/** Port to encode/verify passwords. Implemented in infrastructure (BCrypt). */
public interface PasswordEncoderPort {

    String encode(String passwordPlano);

    boolean matches(String passwordPlano, String hashAlmacenado);
}
