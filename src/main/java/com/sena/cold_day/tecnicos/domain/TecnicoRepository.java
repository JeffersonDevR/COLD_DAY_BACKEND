package com.sena.cold_day.tecnicos.domain;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Soft-delete filtering is enforced by {@code @SQLRestriction} on the entity,
 * so no derived active-only queries are needed here.
 */
public interface TecnicoRepository extends JpaRepository<Tecnico, Long> {
}
