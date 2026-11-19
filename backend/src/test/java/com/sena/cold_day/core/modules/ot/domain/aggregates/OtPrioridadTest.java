package com.sena.cold_day.core.modules.ot.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Prioridad;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OtJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Prioridad de la orden (T2): valor de nacimiento MEDIA, rehidratación sin
 * pérdida de ALTA/BAJA y presencia en la proyección de API. Test de dominio y
 * proyección sin contenedor: no necesita Docker, a diferencia de un IT HTTP.
 */
class OtPrioridadTest {

    private static final Instant AHORA = Instant.parse("2026-11-17T10:00:00Z");

    @Test
    void creaLaOrdenConPrioridadMediaPorDefecto() {
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende",
                List.of(), "Calle 1", new Point(4.6, -74.0), AHORA);

        assertThat(ot.getPrioridad()).isEqualTo(Prioridad.MEDIA);
    }

    @Test
    void laSobrecargaHeredadaDeRehidratarCaeAMedia() {
        // 19 argumentos: la fila no declara prioridad (V17 la backfilleó en MEDIA).
        Ot ot = Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), null,
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(4.6, -74.0), EstadoOt.SOLICITADA, 0.0, null, AHORA,
                null, null, null, null, null, null, null);

        assertThat(ot.getPrioridad()).isEqualTo(Prioridad.MEDIA);
    }

    @Test
    void rehidrataConservandoAltaYbaja() {
        assertThat(otConPrioridad(Prioridad.ALTA).getPrioridad()).isEqualTo(Prioridad.ALTA);
        assertThat(otConPrioridad(Prioridad.BAJA).getPrioridad()).isEqualTo(Prioridad.BAJA);
    }

    @Test
    void laPrioridadSobreviveAlRoundTripDePersistencia() {
        OtJpaEntity fila = OtJpaEntity.fromDomain(otConPrioridad(Prioridad.ALTA));

        assertThat(fila.getPrioridad()).isEqualTo(Prioridad.ALTA);
        assertThat(fila.toDomain().getPrioridad()).isEqualTo(Prioridad.ALTA);
    }

    @Test
    void laApiExponeLaPrioridadDeLaOrden() {
        OtApiResponse respuesta = OtApiResponse.from(OtResponse.fromDomain(otConPrioridad(Prioridad.BAJA)));

        assertThat(respuesta.prioridad()).isEqualTo(Prioridad.BAJA);
    }

    private Ot otConPrioridad(Prioridad prioridad) {
        return Ot.reconstituir(
                OtId.nueva(),                       // 1  id
                ClienteId.nueva(),                  // 2  clienteId
                null,                               // 3  tecnicoId
                CategoriaServicio.REFRIGERACION,    // 4  categoriaServicio
                "No enciende",                      // 5  descripcionFalla
                List.of(),                          // 6  evidenciaUrls
                "Calle 1",                          // 7  direccion
                new Point(4.6, -74.0),              // 8  ubicacion
                EstadoOt.SOLICITADA,                // 9  estado
                0.0,                                // 10 radioKm
                null,                               // 11 ventanaExpiraEn
                AHORA,                              // 12 creadaEn
                null, null, null, null, null, null, null, null,  // 13-20 asignadaEn .. distanciaKm
                null, null, null, null, null, null,              // 21-26 tarifaFuente .. calificacionEstrellas
                null, null, null,                                // 27-29 calificacionComentario .. calificacionTecnicoId
                null, null, null,                                // 30-32 actaFirmaDataUrl .. actaFirmadaEn
                null,                                           // 33 codigo
                prioridad);                                     // 34 prioridad
    }
}
