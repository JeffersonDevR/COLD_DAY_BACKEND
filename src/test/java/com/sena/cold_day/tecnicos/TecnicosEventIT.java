package com.sena.cold_day.tecnicos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.jayway.jsonpath.JsonPath;
import com.sena.cold_day.tecnicos.api.TecnicoCreado;

/**
 * Non-transactional on purpose: AFTER_COMMIT listeners never fire when the
 * test itself rolls back a transaction.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TecnicosEventIT {

	private static final List<Long> OBSERVED = new CopyOnWriteArrayList<>();

	@TestConfiguration
	static class EventRecordingConfiguration {

		@ApplicationModuleListener
		void onTecnicoCreado(TecnicoCreado event) {
			OBSERVED.add(event.tecnicoId());
		}
	}

	@Autowired
	MockMvc mockMvc;

	@AfterEach
	void resetObservations() {
		OBSERVED.clear();
	}

	@Test
	void publishesTecnicoCreadoExactlyOnce() throws Exception {
		MvcResult result = mockMvc
				.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(payload()))
				.andExpect(status().isCreated())
				.andReturn();
		long id = ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();

		awaitEvent(id);

		assertThat(OBSERVED).containsExactly(id);
	}

	private static void awaitEvent(long id) throws InterruptedException {
		long deadline = System.currentTimeMillis() + 2_000;
		while (System.currentTimeMillis() < deadline && !OBSERVED.contains(id)) {
			Thread.sleep(25);
		}
	}

	private String payload() {
		return """
				{"numeroIdentificacion":"123","nombres":"Ana","apellidos":"Garcia","email":"ana@example.com"}
				""";
	}
}
