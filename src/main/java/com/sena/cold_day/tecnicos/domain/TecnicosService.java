package com.sena.cold_day.tecnicos.domain;

import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.api.TecnicoCreado;
import com.sena.cold_day.tecnicos.api.TecnicoRequest;

/**
 * Técnicos use cases. Method names stay Spanish (design choice, SRS §2.3):
 * crear / listar / obtener / actualizar / eliminar.
 */
@Service
public class TecnicosService {

	private final TecnicoRepository repository;

	private final ApplicationEventPublisher events;

	public TecnicosService(TecnicoRepository repository, ApplicationEventPublisher events) {
		this.repository = repository;
		this.events = events;
	}

	@Transactional
	public Tecnico crear(TecnicoRequest request) {
		Tecnico tecnico = request.toEntity();
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
		tecnico.setActivo(true);
		try {
			tecnico = repository.saveAndFlush(tecnico);
		} catch (DataIntegrityViolationException exception) {
			throw new NumeroIdentificacionDuplicadoException(request.numeroIdentificacion());
		}
		// Publication row lands in EVENT_PUBLICATION within this transaction;
		// listeners run after commit.
		events.publishEvent(new TecnicoCreado(tecnico.getId()));
		return tecnico;
	}

	public List<Tecnico> listar() {
		return repository.findAll();
	}

	public Tecnico obtener(Long id) {
		// activo guard: the persistence context bypasses @SQLRestriction for
		// instances already loaded in the same session (soft delete in the
		// current transaction must read as not found).
		return repository.findById(id)
				.filter(Tecnico::isActivo)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
	}

	@Transactional
	public Tecnico actualizar(Long id, TecnicoRequest request) {
		Tecnico tecnico = obtener(id);
		request.applyTo(tecnico);
		return repository.save(tecnico);
	}

	@Transactional
	public void eliminar(Long id) {
		Tecnico tecnico = obtener(id);
		tecnico.setActivo(false);
		// saveAndFlush: the raw-JDBC retention probe and AFTER_COMMIT listeners
		// observe the update within this transaction.
		repository.saveAndFlush(tecnico);
	}
}
