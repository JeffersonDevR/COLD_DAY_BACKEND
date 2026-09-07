package com.sena.cold_day.tecnicos.internal.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.dao.DataIntegrityViolationException;
import org.hibernate.exception.ConstraintViolationException;

import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;

import jakarta.persistence.EntityManager;

@Repository
public class JpaTecnicoRepository implements TecnicoRepository {

	private final EntityManager entityManager;

	public JpaTecnicoRepository(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Override
	public Tecnico save(Tecnico tecnico) {
		return tecnico.getId() == null ? persist(tecnico) : entityManager.merge(tecnico);
	}

	@Override
	public Tecnico saveAndFlush(Tecnico tecnico) {
		try {
			Tecnico saved = save(tecnico);
			entityManager.flush();
			return saved;
		} catch (ConstraintViolationException exception) {
			throw new DataIntegrityViolationException("Tecnico constraint violation", exception);
		}
	}

	@Override
	public List<Tecnico> findAll() {
		return entityManager.createQuery("select t from Tecnico t where t.activo = true", Tecnico.class)
				.getResultList();
	}

	@Override
	public Optional<Tecnico> findById(Long id) {
		return entityManager.createQuery("select t from Tecnico t where t.id = :id and t.activo = true", Tecnico.class)
				.setParameter("id", id).getResultStream().findFirst();
	}

	private Tecnico persist(Tecnico tecnico) {
		entityManager.persist(tecnico);
		return tecnico;
	}
}
