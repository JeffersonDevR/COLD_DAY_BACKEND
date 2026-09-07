package com.sena.cold_day.api.tecnicos.controllers;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.http.MediaType;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.sena.cold_day.api.tecnicos.responses.TecnicoResponse;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;

import reactor.test.StepVerifier;

@SpringBootTest
@AutoConfigureWebTestClient
class TecnicosApiIT {

	@Autowired
	WebTestClient webTestClient;

	@Autowired
	DatabaseClient databaseClient;

	@Autowired
	TecnicoRepository repository;

	@AfterEach
	void cleanup() {
		repository.deleteAll().block();
	}

	@Test
	void createsTecnico() {
		webTestClient.post().uri("/api/tecnicos")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(validPayload("123"))
				.exchange()
				.expectStatus().isCreated()
				.expectBody()
				.jsonPath("$.id").isNumber()
				.jsonPath("$.estadoOperativo").isEqualTo("DISPONIBLE")
				.jsonPath("$.activo").isEqualTo(true);
	}

	@Test
	void listsTecnicos() {
		createTecnico("100");

		webTestClient.get().uri("/api/tecnicos")
				.exchange()
				.expectStatus().isOk()
				.expectBodyList(TecnicoResponse.class)
				.hasSize(1)
				.value(list -> assertThat(list.get(0).numeroIdentificacion()).isEqualTo("100"));
	}

	@Test
	void getsTecnicoById() {
		long id = createTecnico("200");

		webTestClient.get().uri("/api/tecnicos/" + id)
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.id").isNumber()
				.jsonPath("$.numeroIdentificacion").isEqualTo("200")
				.jsonPath("$.nombres").isEqualTo("Ana");
	}

	@Test
	void updatesTecnico() {
		long id = createTecnico("100");

		webTestClient.put().uri("/api/tecnicos/" + id)
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(validPayload("100").replace("Ana", "Ana Maria"))
				.exchange()
				.expectStatus().isOk()
				.expectBody()
				.jsonPath("$.nombres").isEqualTo("Ana Maria")
				.jsonPath("$.estadoOperativo").isEqualTo("DISPONIBLE");
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("invalidPayloads")
	void rejectsInvalidPayload(String description, String payload) {
		webTestClient.post().uri("/api/tecnicos")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(payload)
				.exchange()
				.expectStatus().isBadRequest()
				.expectBody()
				.jsonPath("$.status").isEqualTo(400)
				.jsonPath("$.fieldErrors").isNotEmpty();
	}

	static Stream<org.junit.jupiter.params.provider.Arguments> invalidPayloads() {
		String valid = """
				{"numeroIdentificacion":"123","nombres":"Ana","apellidos":"Garcia","email":"ana@example.com"}
				""";
		return Stream.of(
				org.junit.jupiter.params.provider.Arguments.of("missing nombres",
						valid.replace("\"nombres\":\"Ana\",", "")),
				org.junit.jupiter.params.provider.Arguments.of("missing numeroIdentificacion",
						valid.replace("\"numeroIdentificacion\":\"123\",", "")),
				org.junit.jupiter.params.provider.Arguments.of("missing apellidos",
						valid.replace("\"apellidos\":\"Garcia\",", "")),
				org.junit.jupiter.params.provider.Arguments.of("malformed email",
						valid.replace("ana@example.com", "not-an-email")));
	}

	@Test
	void unknownIdReturns404() {
		webTestClient.get().uri("/api/tecnicos/999")
				.exchange().expectStatus().isNotFound();

		webTestClient.put().uri("/api/tecnicos/999")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(validPayload("999"))
				.exchange().expectStatus().isNotFound();

		webTestClient.delete().uri("/api/tecnicos/999")
				.exchange().expectStatus().isNotFound();
	}

	@Test
	void softDeletesTecnico() {
		long id = createTecnico("100");

		webTestClient.get().uri("/api/tecnicos")
				.exchange().expectBodyList(TecnicoResponse.class).hasSize(1);

		webTestClient.delete().uri("/api/tecnicos/" + id)
				.exchange().expectStatus().isNoContent();

		webTestClient.get().uri("/api/tecnicos/" + id)
				.exchange().expectStatus().isNotFound();

		StepVerifier.create(databaseClient.sql("SELECT activo FROM tecnico WHERE id = :id")
				.bind("id", id)
				.map(row -> row.get("activo", Boolean.class))
				.one())
				.expectNext(false)
				.verifyComplete();

		webTestClient.get().uri("/api/tecnicos")
				.exchange().expectBodyList(TecnicoResponse.class).hasSize(0);
	}

	@Test
	void rejectsDuplicateNumeroIdentificacion() {
		createTecnico("123");

		webTestClient.post().uri("/api/tecnicos")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(validPayload("123"))
				.exchange()
				.expectStatus().is5xxServerError(); // By default ConstraintViolation in R2DBC falls back to 500 without global handler unless specified.
	}

	private long createTecnico(String numeroIdentificacion) {
		return webTestClient.post().uri("/api/tecnicos")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(validPayload(numeroIdentificacion))
				.exchange()
				.expectStatus().isCreated()
				.returnResult(TecnicoResponse.class)
				.getResponseBody()
				.blockFirst()
				.id();
	}

	private String validPayload(String numeroIdentificacion) {
		return """
				{"numeroIdentificacion":"%s","nombres":"Ana","apellidos":"Garcia","telefono":"3001234567",
				 "email":"ana@example.com"}
				""".formatted(numeroIdentificacion);
	}
}
