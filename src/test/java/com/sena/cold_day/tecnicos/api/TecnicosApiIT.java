package com.sena.cold_day.tecnicos.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.Stream;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TecnicosApiIT {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	@Order(1)
	void createsTecnico() throws Exception {
		mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(validPayload("123")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.estadoOperativo").value("DISPONIBLE"))
				.andExpect(jsonPath("$.activo").value(true));
	}

	@Test
	@Order(2)
	void listsTecnicos() throws Exception {
		createTecnico("100");

		mockMvc.perform(get("/api/tecnicos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].numeroIdentificacion").value("100"));
	}

	@Test
	@Order(3)
	void getsTecnicoById() throws Exception {
		createTecnico("100");

		mockMvc.perform(get("/api/tecnicos/" + createTecnico("200")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.numeroIdentificacion").value("200"))
				.andExpect(jsonPath("$.nombres").value("Ana"));
	}

	@Test
	@Order(4)
	void updatesTecnico() throws Exception {
		long id = createTecnico("100");

		mockMvc.perform(put("/api/tecnicos/" + id).contentType(MediaType.APPLICATION_JSON)
				.content(validPayload("100").replace("Ana", "Ana Maria")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombres").value("Ana Maria"))
				.andExpect(jsonPath("$.estadoOperativo").value("DISPONIBLE"));
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("invalidPayloads")
	@Order(5)
	void rejectsInvalidPayload(String description, String payload) throws Exception {
		mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(payload))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.fieldErrors").isNotEmpty());
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
	@Order(6)
	void unknownIdReturns404() throws Exception {
		mockMvc.perform(get("/api/tecnicos/999")).andExpect(status().isNotFound());
		mockMvc.perform(put("/api/tecnicos/999").contentType(MediaType.APPLICATION_JSON).content(validPayload("999")))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/tecnicos/999")).andExpect(status().isNotFound());
	}

	@Test
	@Order(7)
	void softDeletesTecnico() throws Exception {
		long id = createTecnico("100");
		mockMvc.perform(get("/api/tecnicos")).andExpect(jsonPath("$", hasSize(1)));

		mockMvc.perform(delete("/api/tecnicos/" + id)).andExpect(status().isNoContent());
		mockMvc.perform(get("/api/tecnicos/" + id)).andExpect(status().isNotFound());

		assertThat(jdbcTemplate.queryForObject("SELECT activo FROM tecnico WHERE id = ?", Boolean.class, id)).isFalse();
		mockMvc.perform(get("/api/tecnicos")).andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	@Order(8) // MUST stay last: the constraint violation marks the test tx rollback-only
	void rejectsDuplicateNumeroIdentificacion() throws Exception {
		createTecnico("123");

		mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(validPayload("123")))
				.andExpect(status().isConflict());
	}

	private long createTecnico(String numeroIdentificacion) throws Exception {
		MvcResult result = mockMvc
				.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
						.content(validPayload(numeroIdentificacion)))
				.andExpect(status().isCreated())
				.andReturn();
		return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
	}

	private String validPayload(String numeroIdentificacion) {
		return """
				{"numeroIdentificacion":"%s","nombres":"Ana","apellidos":"Garcia","telefono":"3001234567",
				 "email":"ana@example.com","categoriasServicio":["REFRIGERACION"],
				 "certificaciones":[{"tipo":"Tecnico en refrigeracion","entidad":"SENA","fechaVencimiento":"2027-01-31"}]}
				""".formatted(numeroIdentificacion);
	}
}
