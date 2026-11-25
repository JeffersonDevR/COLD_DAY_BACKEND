package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorCercano;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.ProveedorJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.EntityManager;

@Repository
public class ProveedorRepositoryAdapter implements ProveedorRepository {

    private static final double METROS_POR_KM = 1000.0;

    // Same geography predicate as PostgisTecnicoDisponibilidadAdapter (ST_DWithin + ST_Distance).
    private static final String BUSQUEDA_ESPACIAL = """
            SELECT p.id, ST_Distance(
                ST_MakePoint(p.longitud, p.latitud)::geography,
                ST_MakePoint(:lon, :lat)::geography) / 1000.0
            FROM proveedor p
            WHERE p.activo = true
              AND p.estado_validacion = 'APROBADO'
              AND p.latitud IS NOT NULL
              AND p.longitud IS NOT NULL
              AND ST_DWithin(
                ST_MakePoint(p.longitud, p.latitud)::geography,
                ST_MakePoint(:lon, :lat)::geography,
                :radioMetros)
            ORDER BY 2
            """;

    private final SpringDataProveedorRepository repository;
    private final EntityManager entityManager;

    public ProveedorRepositoryAdapter(SpringDataProveedorRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    @Override
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<ProveedorCercano> buscarElegiblesEnRadio(Point centro, double radioKm) {
        if (centro == null) {
            throw new IllegalArgumentException("El centro de busqueda es requerido");
        }
        if (radioKm <= 0) {
            throw new IllegalArgumentException("El radio debe ser positivo");
        }
        List<Object[]> filas = entityManager.createNativeQuery(BUSQUEDA_ESPACIAL)
                .setParameter("lat", centro.latitud())
                .setParameter("lon", centro.longitud())
                .setParameter("radioMetros", radioKm * METROS_POR_KM)
                .getResultList();
        return filas.stream()
                .map(fila -> new ProveedorCercano(ProveedorId.desde(convertirId(fila[0])),
                        ((Number) fila[1]).doubleValue()))
                .toList();
    }

    private static UUID convertirId(Object valor) {
        return valor instanceof UUID uuid ? uuid : UUID.fromString(valor.toString());
    }

    @Override
    @Transactional
    public Proveedor save(Proveedor proveedor) {
        ProveedorJpaEntity entity = proveedor.getId() == null
                ? ProveedorJpaEntity.fromDomain(proveedor)
                : repository.findById(proveedor.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(proveedor);
                            return existing;
                        })
                        .orElseGet(() -> ProveedorJpaEntity.fromDomain(proveedor));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Proveedor> findAll() {
        return repository.findAll().stream().map(ProveedorJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Proveedor> buscarPorId(ProveedorId id) {
        return repository.findById(id.valor()).map(ProveedorJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Proveedor> findByUsuarioId(Long usuarioId) {
        return repository.findByUsuarioId(usuarioId).map(ProveedorJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Proveedor> findByActivoTrue() {
        return repository.findByActivoTrue().stream().map(ProveedorJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
