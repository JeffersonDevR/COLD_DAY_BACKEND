package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/ot/{id}/acta}: the client's signature exactly as the
 * canvas produced it, a base64 data URL.
 *
 * <p>The size ceiling mirrors {@link Ot#MAX_FIRMA_ACTA_CHARS} so the request is
 * refused at the edge instead of being read into memory and then rejected. The
 * domain repeats the check: bean validation guards the transport, the aggregate
 * guards the invariant.
 */
public record FirmarActaApiRequest(
        @NotBlank @Size(max = Ot.MAX_FIRMA_ACTA_CHARS) String firmaDataUrl) {
}
