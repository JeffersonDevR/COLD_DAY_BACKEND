package com.sena.cold_day.core.shared.infrastructure.seed;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Siembra datos de demostración (5 clientes + 5 técnicos + admin + contable).
 *
 * Es <b>idempotente y auto-reparable</b>: por cada correo sembrado, crea el
 * Usuario si falta y, si el usuario ya existe pero no tiene su perfil
 * (Cliente/Técnico), se lo crea. Así se reparan usuarios "huérfanos" creados por
 * un alta que no generó el perfil (que luego fallaban al crear una OT con 404
 * "No existe un perfil de cliente para el usuario").
 *
 * Se desactiva con {@code app.seed.enabled=false} (o APP_SEED_ENABLED=false).
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DevDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);
    private static final String PASSWORD_DEMO = "demo1234";

    private final UsuarioRepository usuarioRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ClienteRepository clienteRepository;
    private final ProveedorRepository proveedorRepository;
    private final PasswordEncoderPort encoder;

    public DevDataSeeder(UsuarioRepository usuarioRepository, TecnicoRepository tecnicoRepository,
            ClienteRepository clienteRepository, ProveedorRepository proveedorRepository,
            PasswordEncoderPort encoder) {
        this.usuarioRepository = usuarioRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clienteRepository = clienteRepository;
        this.proveedorRepository = proveedorRepository;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<ClienteSeed> clientes = List.of(
                new ClienteSeed("María Gómez", "cliente1@coldday.com.co", "3187654321", "Calle 15 # 3E-28", "Los Caobos", new Point(7.8872, -72.4951)),
                new ClienteSeed("Andrés Ramírez", "cliente2@coldday.com.co", "3104567890", "Avenida 4 # 11-20", "La Riviera", new Point(7.8911, -72.4933)),
                new ClienteSeed("Laura Peña", "cliente3@coldday.com.co", "3156789012", "Calle 10 # 5-45", "Guaimaral", new Point(7.9045, -72.4977)),
                new ClienteSeed("Jorge Silva", "cliente4@coldday.com.co", "3203456789", "Carrera 8 # 12-10", "Centro", new Point(7.8928, -72.5052)),
                new ClienteSeed("Diana Torres", "cliente5@coldday.com.co", "3009876543", "Calle 17 # 8-30", "Quinta Oriental", new Point(7.8971, -72.4915)));

        List<TecnicoSeed> tecnicos = List.of(
                new TecnicoSeed("Juan Pérez", "tecnico1@coldday.com.co", "3001234567", "1098765001",
                        Set.of(CategoriaServicio.AIRE_ACONDICIONADO, CategoriaServicio.REFRIGERACION), new Point(7.8860, -72.4980)),
                new TecnicoSeed("Andrés Suárez", "tecnico2@coldday.com.co", "3012345678", "1098765002",
                        Set.of(CategoriaServicio.REFRIGERACION), new Point(7.9050, -72.5020)),
                new TecnicoSeed("Carlos Rojas", "tecnico3@coldday.com.co", "3023456789", "1098765003",
                        Set.of(CategoriaServicio.ELECTRICIDAD), new Point(7.8750, -72.4850)),
                new TecnicoSeed("Héctor Mora", "tecnico4@coldday.com.co", "3034567890", "1098765004",
                        Set.of(CategoriaServicio.ELECTRODOMESTICOS), new Point(7.8420, -72.5080)),
                new TecnicoSeed("Diego Castillo", "tecnico5@coldday.com.co", "3045678901", "1098765005",
                        Set.of(CategoriaServicio.AIRE_ACONDICIONADO, CategoriaServicio.ELECTRICIDAD), new Point(7.8915, -72.4885)));

        List<ProveedorSeed> proveedores = List.of(
                new ProveedorSeed("Suministros del Norte", "proveedor1@coldday.com.co", "3105550001",
                        "Suministros del Norte S.A.S.", "900123456-1", "Avenida 6 # 10-50",
                        new Point(7.8950, -72.5010),
                        Set.of("AIRE_ACONDICIONADO", "REFRIGERACION")));

        int clientesCreados = 0;
        for (ClienteSeed seed : clientes) {
            Long usuarioId = ensureUsuario(seed.nombre(), seed.correo(), seed.telefono(), Rol.CLIENTE);
            if (clienteRepository.findByUsuarioId(new UsuarioId(usuarioId)).isEmpty()) {
                clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                        DireccionPrincipal.con(seed.calle(), "Cúcuta", seed.barrio(), seed.ubicacion())));
                clientesCreados++;
            }
        }

        int tecnicosCreados = 0;
        for (TecnicoSeed seed : tecnicos) {
            Long usuarioId = ensureUsuario(seed.nombre(), seed.correo(), seed.telefono(), Rol.TECNICO);
            if (tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId).isEmpty()) {
                tecnicoRepository.save(Tecnico.reconstituir(TecnicoId.nueva(), usuarioId, seed.numeroIdentificacion(),
                        seed.categorias(), EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO, null, Set.of(), true,
                        seed.ubicacion(), true, Instant.now()));
                tecnicosCreados++;
            }
        }

        int proveedoresCreados = 0;
        for (ProveedorSeed seed : proveedores) {
            Long usuarioId = ensureUsuario(seed.nombre(), seed.correo(), seed.telefono(), Rol.PROVEEDOR);
            if (proveedorRepository.findByUsuarioId(usuarioId).isEmpty()) {
                proveedorRepository.save(Proveedor.crear(usuarioId, seed.razonSocial(), seed.nit(),
                        seed.telefono(), seed.direccion(), seed.ubicacion(), seed.categoriasInsumo()));
                proveedoresCreados++;
            }
        }

        // Roles administrativos para poder observar los paneles de gestión.
        ensureUsuario("Carlos Méndez", "admin@coldday.com.co", "3104567890", Rol.ADMINISTRADOR);
        ensureUsuario("Ana Martínez", "contable@coldday.com.co", "3156789012", Rol.CONTABLE);

        log.info("Seed verificado: {} clientes, {} técnicos y {} proveedores creados (perfiles faltantes reparados). Password demo: {}.",
                clientesCreados, tecnicosCreados, proveedoresCreados, PASSWORD_DEMO);
    }

    /**
     * Devuelve el id del usuario con ese correo; si no existe, lo crea con el rol
     * indicado y la contraseña demo. No modifica usuarios existentes.
     */
    private Long ensureUsuario(String nombre, String correo, String telefono, Rol rol) {
        return usuarioRepository.buscarPorCorreo(correo)
                .map(Usuario::getId)
                .orElseGet(() -> usuarioRepository.save(
                        Usuario.registrar(nombre, correo, PASSWORD_DEMO, telefono, null, rol, true, encoder)).getId());
    }

    private record ClienteSeed(String nombre, String correo, String telefono, String calle, String barrio,
            Point ubicacion) {
    }

    private record TecnicoSeed(String nombre, String correo, String telefono, String numeroIdentificacion,
            Set<CategoriaServicio> categorias, Point ubicacion) {
    }

    private record ProveedorSeed(String nombre, String correo, String telefono, String razonSocial,
            String nit, String direccion, Point ubicacion, Set<String> categoriasInsumo) {
    }
}
