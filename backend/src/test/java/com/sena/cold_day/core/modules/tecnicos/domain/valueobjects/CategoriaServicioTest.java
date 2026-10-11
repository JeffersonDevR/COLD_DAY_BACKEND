package com.sena.cold_day.core.modules.tecnicos.domain.valueobjects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;

/**
 * Contract tests for the canonical service-category catalog
 * (spec service-category-catalog R1/R2): exactly five target literals and the
 * legacy ELECTRODOMESTICOS literal is no longer accepted.
 */
class CategoriaServicioTest {

	@Test
	void catalogContainsExactlyTheFiveTargetLiterals() {
		assertThat(CategoriaServicio.values()).containsExactlyInAnyOrder(
				CategoriaServicio.CAMARAS_VIGILANCIA,
				CategoriaServicio.REFRIGERACION,
				CategoriaServicio.AIRE_ACONDICIONADO,
				CategoriaServicio.LAVADORAS,
				CategoriaServicio.ELECTRICIDAD);
	}

	@Test
	void legacyElectrodomesticosLiteralIsRejected() {
		assertThatIllegalArgumentException()
				.isThrownBy(() -> CategoriaServicio.valueOf("ELECTRODOMESTICOS"))
				.withMessageContaining("ELECTRODOMESTICOS");
	}

	@Test
	void remappedAndNewLiteralsAreAccepted() {
		assertThat(CategoriaServicio.valueOf("LAVADORAS")).isEqualTo(CategoriaServicio.LAVADORAS);
		assertThat(CategoriaServicio.valueOf("CAMARAS_VIGILANCIA"))
				.isEqualTo(CategoriaServicio.CAMARAS_VIGILANCIA);
	}
}
