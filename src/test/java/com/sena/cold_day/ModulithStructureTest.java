package com.sena.cold_day;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.core.NamedInterfaces;

class ModulithStructureTest {

	@Test
	void verifiesModularity() {
		ApplicationModules.of(ColdDayApplication.class).verify();
	}

	@Test
	void detectsTecnicosModuleWithApiNamedInterface() {
		ApplicationModule tecnicos = ApplicationModules.of(ColdDayApplication.class)
				.getModuleByName("tecnicos")
				.orElseThrow(() -> new AssertionError("tecnicos module not detected"));
		NamedInterfaces namedInterfaces = tecnicos.getNamedInterfaces();
		assertThat(namedInterfaces.getByName("api"))
				.as("tecnicos must expose the 'api' named interface")
				.isPresent();
	}
}
