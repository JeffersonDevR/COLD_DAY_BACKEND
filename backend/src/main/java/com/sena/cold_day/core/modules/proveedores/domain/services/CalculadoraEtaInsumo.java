package com.sena.cold_day.core.modules.proveedores.domain.services;

import com.sena.cold_day.core.modules.proveedores.domain.exception.EtaInvalidoException;

/**
 * ETA of an insumo delivery (design 2026-11-25). The suggestion is straight-line
 * distance over an average speed — no routing, no traffic — and it is only a
 * starting point: the supplier commits to its own figure, which must fall in
 * {@code [1, etaMaximoMinutos]}. Speed and cap are configuration, not product
 * policy.
 */
public final class CalculadoraEtaInsumo {

    private final double velocidadKmh;
    private final int etaMaximoMinutos;

    public CalculadoraEtaInsumo(double velocidadKmh, int etaMaximoMinutos) {
        if (velocidadKmh <= 0) {
            throw new IllegalArgumentException("La velocidad promedio debe ser positiva");
        }
        if (etaMaximoMinutos < 1) {
            throw new IllegalArgumentException("El tope del ETA debe ser de al menos 1 minuto");
        }
        this.velocidadKmh = velocidadKmh;
        this.etaMaximoMinutos = etaMaximoMinutos;
    }

    /** Minutes to cover {@code distanciaKm}, rounded up, at least 1 and never above the cap. */
    public int sugerir(double distanciaKm) {
        long minutos = (long) Math.ceil(distanciaKm / velocidadKmh * 60.0);
        return (int) Math.min(Math.max(minutos, 1L), etaMaximoMinutos);
    }

    /** Guards the ETA a supplier commits to on accept. */
    public void validar(int etaMinutos) {
        if (etaMinutos < 1 || etaMinutos > etaMaximoMinutos) {
            throw new EtaInvalidoException(etaMaximoMinutos);
        }
    }

    public int getEtaMaximoMinutos() {
        return etaMaximoMinutos;
    }
}
