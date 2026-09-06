package com.sena.cold_day.tecnicos.domain;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.api.TecnicoRequest;

/**
 * Técnicos use cases. Method names stay Spanish (design choice, SRS §2.3):
 * crear / listar / obtener / actualizar / eliminar.
 */
@Service
public class TecnicosService {

	private final TecnicoRepository repository;

	public TecnicosService(TecnicoRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public Tecnico crear(TecnicoRequest request) {
		Tecnico tecnico = request.toEntity();
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
		tecnico.setActivo(true);
		try {
			return repository.saveAndFlush(tecnico);
		} catch (DataIntegrityViolationException exception) {
			throw new NumeroIdentificacionDuplicadoException(request.numeroIdentificacion());
		}
	}

	public List<Tecnico> listar() {
		return repository.findAll();
	}

	public Tecnico obtener(Long id) {
		return repository.findById(id)
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
		repository.save(tecnico);
	}
}
