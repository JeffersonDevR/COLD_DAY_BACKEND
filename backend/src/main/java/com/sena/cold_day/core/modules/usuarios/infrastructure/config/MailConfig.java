package com.sena.cold_day.core.modules.usuarios.infrastructure.config;

import java.util.Properties;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Registers {@link MailProperties} and builds the SMTP transport only when mail
 * is enabled (mirrors the module convention of {@code MapsConfig} /
 * {@code TarifaConfig}).
 *
 * <p>The {@link JavaMailSender} is assembled from {@code app.mail.*} instead of
 * Spring Boot's {@code spring.mail.*} autoconfiguration so there is a single,
 * validated source of truth: when {@code app.mail.enabled=false} no sender bean
 * exists and the logging fallback adapter is the only notifier. TLS (STARTTLS)
 * is required whenever {@code app.mail.tls=true} (M10).
 */
@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig {

    @Bean
    @ConditionalOnProperty(name = "app.mail.enabled", havingValue = "true")
    JavaMailSender javaMailSender(MailProperties propiedades) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(propiedades.host());
        sender.setPort(propiedades.port());
        sender.setUsername(propiedades.username());
        sender.setPassword(propiedades.password());

        Properties javaMail = sender.getJavaMailProperties();
        javaMail.put("mail.smtp.auth", "true");
        javaMail.put("mail.smtp.starttls.enable", String.valueOf(propiedades.tls()));
        javaMail.put("mail.smtp.starttls.required", String.valueOf(propiedades.tls()));
        return sender;
    }
}
