package com.sena.cold_day.tecnicos.internal.domain;

import java.util.List;
import java.util.Optional;

/**
 * Soft-delete filtering is enforced by {@code @SQLRestriction} on the entity,
 * so no derived active-only queries are needed here.
 */
public interface TecnicoRepository {

	Tecnico save(Tecnico tecnico);

	Tecnico saveAndFlush(Tecnico tecnico);

	List<Tecnico> findAll();

	Optional<Tecnico> findById(Long id);
}
