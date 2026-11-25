package com.sena.cold_day.core.modules.proveedores.infrastructure.scheduling;

import static org.mockito.Mockito.inOrder;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.application.usecases.AvisarEtaVencidoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.EscalarRadioInsumosUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ExpirarInsumosUseCase;

/** One sweep path: widen the radius first, close what expired, then warn about elapsed ETAs. */
@ExtendWith(MockitoExtension.class)
class ProgramadorExpiracionInsumoTest {

    @Mock EscalarRadioInsumosUseCase escalarRadio;
    @Mock ExpirarInsumosUseCase expirarInsumos;
    @Mock AvisarEtaVencidoUseCase avisarEtaVencido;

    @Test
    void escalatesBeforeExpiring() {
        new ProgramadorExpiracionInsumo(escalarRadio, expirarInsumos, avisarEtaVencido).barrer();

        InOrder orden = inOrder(escalarRadio, expirarInsumos, avisarEtaVencido);
        orden.verify(escalarRadio).ejecutar();
        orden.verify(expirarInsumos).expirar();
        orden.verify(avisarEtaVencido).ejecutar();
    }
}
