package com.sena.cold_day.core.modules.tecnicos.domain.services;

import com.sena.cold_day.core.modules.tecnicos.domain.events.DocumentoPorVencer;

/**
 * Delivery port for pre-expiry notices (C3). Delivery transport is optional:
 * a logging/no-op adapter ships now and a real channel can replace it without
 * the domain knowing.
 */
public interface NotificacionVigenciaPort {

	void notificarProximoVencimiento(DocumentoPorVencer aviso);
}
