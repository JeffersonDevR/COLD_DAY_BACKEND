package com.sena.cold_day.core.modules.ot.infrastructure.notification;

/**
 * Canal de notificaciones de Android. El id es un contrato con la app
 * ({@code CANALES_PUSH} en core/push.ts): ahi se crean con su sonido, y un canal
 * de Android no se puede cambiar una vez creado. Un id distinto aqui deja el
 * aviso sin el sonido propio.
 */
public enum CanalPush {

    /** Tecnico: nueva oferta de OT. */
    OT_NUEVA_TEC("ot_nueva_tec"),
    /** Tecnico: actualizacion de la OT en curso. */
    OT_UPDATE_TEC("ot_update_tec"),
    /** Cliente: presupuesto enviado o tecnico asignado. */
    OT_NUEVA_CLI("ot_nueva_cli"),
    /** Cliente: otras actualizaciones de su OT. */
    OT_UPDATE_CLI("ot_update_cli"),
    /** Proveedor: nueva solicitud de repuestos a su alcance. */
    INSUMO_NUEVO_PROV("insumo_nuevo_prov");

    private final String id;

    CanalPush(String id) {
        this.id = id;
    }

    String id() {
        return id;
    }
}
