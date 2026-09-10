package com.sena.cold_day.core.modules.clientes.domain.valueobjects;
import com.sena.cold_day.core.shared.domain.Point;

public class DireccionPrincipal {
    private final String calle;
    private final String ciudad;
    private final String barrio;
    private final Point ubicacion;

    private  DireccionPrincipal(String calle, String ciudad, String barrio, Point ubicacion){
        if (calle == null || calle.isBlank()){
            throw new IllegalArgumentException("La calle es obligatoria");
        }
        if (ciudad == null || ciudad.isBlank()){
            throw new IllegalArgumentException("la ciudad es obligatoria");
        }

        this.calle = calle;
        this.ciudad = ciudad;
        this.barrio = barrio;
        this.ubicacion = ubicacion;

    }

    public static DireccionPrincipal sinUbicacion(String calle, String ciudad, String barrio){
        return new DireccionPrincipal(calle,ciudad,barrio,null);

    }

    public static DireccionPrincipal con(String calle, String ciudad, String barrio, Point ubicacion) {
        return new DireccionPrincipal(calle, ciudad, barrio, ubicacion);
    }

    public boolean tieneUbicacion() {
        return ubicacion != null;
    }

    public String textoCompleto() {
        return calle + (barrio != null ? ", " + barrio : "") + ", " + ciudad;
    }

    public String getCalle() {
        return calle;
    }

    public String getCiudad() {
        return ciudad;
    }

    public String getBarrio() {
        return barrio;
    }

    public Point getUbicacion() {
        return ubicacion;
    }

    @Override
    public boolean equals(Object o){
        if (this == o) return true;
        if (!(o instanceof DireccionPrincipal that)) return false;
        return calle.equals(that.calle) && ciudad.equals(that.ciudad)
                && java.util.Objects.equals(barrio,that.barrio)
                && java.util.Objects.equals(ubicacion,that.ubicacion);

    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(calle, ciudad, barrio, ubicacion);
    }

}
