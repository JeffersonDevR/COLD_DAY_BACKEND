package com.sena.cold_day.modules.tecnicos.domain.events;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.sena.cold_day.api.tecnicos.responses.TecnicoResponse;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.events.TecnicoCreado;

@SpringBootTest
@AutoConfigureWebTestClient
class TecnicosEventIT {

	private static final List<Long> OBSERVED = new CopyOnWriteArrayList<>();

	@TestConfiguration
	static class EventRecordingConfiguration {

		@EventListener
		void onTecnicoCreado(TecnicoCreado event) {
			OBSERVED.add(event.tecnicoId());
		}
	}

	@Autowired
	WebTestClient webTestClient;

	@Autowired
	TecnicoRepository repository;

	@AfterEach
	void resetObservations() {
		OBSERVED.clear();
		repository.deleteAll().block();
	}

	@Test
	void publishesTecnicoCreadoExactlyOnce() throws InterruptedException {
		long id = webTestClient.post().uri("/api/tecnicos")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(payload())
				.exchange()
				.expectStatus().isCreated()
				.returnResult(TecnicoResponse.class)
				.getResponseBody()
				.blockFirst()
				.id();

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
