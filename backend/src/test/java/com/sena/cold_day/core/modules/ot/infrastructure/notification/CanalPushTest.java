package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** Los ids son el contrato con la app (core/push.ts): cambiar uno sin el otro deja el push sin sonido. */
class CanalPushTest {

    @Test
    void idsCoincidenConLaApp() {
        assertEquals(
                List.of("ot_nueva_tec", "ot_update_tec", "ot_nueva_cli", "ot_update_cli", "insumo_nuevo_prov"),
                Arrays.stream(CanalPush.values()).map(CanalPush::id).toList());
    }
}
