package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;


@Service
public class EliminarTecnicoUseCase {

	private final TecnicoRepository repository;
	private final UsuarioRepository usuarioRepository;

	public EliminarTecnicoUseCase(TecnicoRepository repository, UsuarioRepository usuarioRepository) {
		this.repository = repository;
		this.usuarioRepository = usuarioRepository;
	}

	/**
	 * Baja del perfil tecnico: desactiva el perfil y ademas revoca los tokens del
	 * usuario dueno. Sin lo segundo, el JWT ya emitido seguia autenticando durante
	 * una hora con ROLE_TECNICO (ver JwtAuthenticationFilter.versionVigente: solo
	 * compara `ver`, no consulta el estado del perfil).
	 */
	@Transactional
	public void eliminar(TecnicoId id) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.desactivar();
		repository.save(tecnico);
		revocarTokens(tecnico.getUsuarioId());
	}

	private void revocarTokens(Long usuarioId) {
		usuarioRepository.buscarPorId(new UsuarioId(usuarioId)).ifPresent(usuario -> {
			usuario.incrementarTokenVersion();
			usuarioRepository.save(usuario);
		});
	}
}
