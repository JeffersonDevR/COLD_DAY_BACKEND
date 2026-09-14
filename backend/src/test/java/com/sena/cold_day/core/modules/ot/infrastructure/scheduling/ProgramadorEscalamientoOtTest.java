package com.sena.cold_day.core.modules.ot.infrastructure.scheduling;

import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.ot.application.usecases.EscalarRadioUseCase;

/**
 * The scheduler is a thin trigger: tests never wait for it, they assert it
 * delegates to {@link EscalarRadioUseCase} and invoke the use case directly with
 * a fixed clock (design D6).
 */
@ExtendWith(MockitoExtension.class)
class ProgramadorEscalamientoOtTest {

    @Mock EscalarRadioUseCase escalarRadio;

    @Test
    void drivesTheEscalationUseCase() {
        new ProgramadorEscalamientoOt(escalarRadio).escalar();

        verify(escalarRadio).ejecutar();
    }
}
