package com.sena.cold_day.core.shared.domain;

public record Point(double latitud, double longitud) {

    public Point{
        if (latitud < -90 || latitud > 90){
            throw new IllegalArgumentException("latitud fuera de rango");
        }
        if (longitud < -90 || longitud > 90){
            throw new IllegalArgumentException("longitud fuera de rango");
        }
    }

}
