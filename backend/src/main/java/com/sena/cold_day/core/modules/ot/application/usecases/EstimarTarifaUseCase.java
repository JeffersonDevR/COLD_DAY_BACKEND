package com.sena.cold_day.core.modules.ot.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.geolocalizacion.domain.services.CalculadoraHaversine;
import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.ot.domain.services.CalculadoraTarifaVisita;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaEstimada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Read-only visit tariff estimate (spec tar.R4/R5, design AD9/AD10). It measures
 * the distance from the configured service center to the destination using the
 * non-throwing {@link MapsUseCase#distanciaOpcional} and feeds the pure
 * {@link CalculadoraTarifaVisita}. When maps is unavailable or fails, it falls
 * back to the Haversine distance and flags the source as {@code LINEAL}. It
 * never creates or mutates an OT.
 */
@Service
public class EstimarTarifaUseCase {

    private final MapsUseCase maps;
    private final TarifaProperties props;
    private final CalculadoraTarifaVisita calculadora;

    public EstimarTarifaUseCase(MapsUseCase maps, TarifaProperties props) {
        this.maps = maps;
        this.props = props;
        this.calculadora = props.aCalculadora();
    }

    public TarifaEstimada estimar(double latitud, double longitud) {
        Point centro = new Point(props.centroLat(), props.centroLng());
        Point destino = new Point(latitud, longitud);
        return maps.distanciaOpcional(centro.latitud(), centro.longitud(), destino.latitud(), destino.longitud())
                .map(ruta -> calculadora.calcular(ruta.distanciaKm(), TarifaFuente.ROAD))
                .orElseGet(() -> calculadora.calcular(
                        CalculadoraHaversine.distanciaKm(centro, destino), TarifaFuente.LINEAL));
    }
}
