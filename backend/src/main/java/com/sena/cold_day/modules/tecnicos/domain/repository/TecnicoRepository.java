package com.sena.cold_day.modules.tecnicos.domain.repository;

import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface TecnicoRepository extends ReactiveCrudRepository<Tecnico, Long> {

    Flux<Tecnico> findByActivoTrue();

    Mono<Tecnico> findByIdAndActivoTrue(Long id);
}
