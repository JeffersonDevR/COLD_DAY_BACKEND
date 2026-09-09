package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;

/** Real implementation of the domain port using Spring Security's BCrypt. */
@Component
public class PasswordEncoderAdapter implements PasswordEncoderPort {

    private final BCryptPasswordEncoder delegate = new BCryptPasswordEncoder();

    @Override
    public String encode(String passwordPlano) {
        return delegate.encode(passwordPlano);
    }

    @Override
    public boolean matches(String passwordPlano, String hashAlmacenado) {
        return delegate.matches(passwordPlano, hashAlmacenado);
    }
}
