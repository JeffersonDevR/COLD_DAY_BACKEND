import { Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { ActorOt, EstadoOt, puedeTransicionar } from '../../domain/models/estado-ot.model';
import {
  CrearOrdenTrabajoRequest,
  DiagnosticoRequest,
  HistorialEstado,
  OrdenTrabajo,
} from '../../domain/models/orden-trabajo.model';

const LATENCIA_MS = 350;
const TARIFA_VISITA = 30000;

const TECNICOS_DISPONIBLES = [
  { id: 'TEC-01', nombre: 'Carlos Ruiz' },
  { id: 'TEC-02', nombre: 'Jorge Salas' },
  { id: 'TEC-03', nombre: 'Camila Pardo' },
  { id: 'TEC-04', nombre: 'Andrés Mora' },
];

function haceHoras(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function historial(...entradas: HistorialEstado[]): HistorialEstado[] {
  return entradas;
}

function crearDatosIniciales(): OrdenTrabajo[] {
  return [
    {
      id: 'OT-1001',
      clienteId: 'CLI-01',
      clienteNombre: 'Ana Gómez',
      categoriaServicio: 'AIRE_ACONDICIONADO',
      estado: 'EN_CAMINO',
      tecnicoId: 'TEC-01',
      tecnicoNombre: 'Carlos Ruiz',
      direccion: 'Calle 10 #5-20',
      barrio: 'Centro',
      descripcionFalla: 'El aire acondicionado no enfría y bota agua.',
      creadaEn: haceHoras(4),
      actualizadaEn: haceHoras(1),
      tarifaVisita: 0,
      radioKm: 10,
      presupuesto: null,
      diagnostico: null,
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(4), motivo: 'Solicitud creada' },
        {
          estado: 'BUSCANDO_TECNICO',
          actor: 'SISTEMA',
          fecha: haceHoras(4),
          motivo: 'Difusión a técnicos en 10 km',
        },
        {
          estado: 'ASIGNADA',
          actor: 'SISTEMA',
          fecha: haceHoras(3),
          motivo: 'Carlos Ruiz aceptó la oferta',
        },
        {
          estado: 'EN_CAMINO',
          actor: 'TECNICO',
          fecha: haceHoras(1),
          motivo: 'El técnico inició el desplazamiento',
        },
      ),
    },
    {
      id: 'OT-1002',
      clienteId: 'CLI-02',
      clienteNombre: 'Luis Pérez',
      categoriaServicio: 'ELECTRICIDAD',
      estado: 'BUSCANDO_TECNICO',
      tecnicoId: null,
      tecnicoNombre: null,
      direccion: 'Av. Libertadores #12-45',
      barrio: 'Los Patios',
      descripcionFalla: 'Corto circuito en el tablero principal.',
      creadaEn: haceHoras(1),
      actualizadaEn: haceHoras(1),
      tarifaVisita: 0,
      radioKm: 15,
      presupuesto: null,
      diagnostico: null,
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(1) },
        {
          estado: 'BUSCANDO_TECNICO',
          actor: 'SISTEMA',
          fecha: haceHoras(1),
          motivo: 'Sin respuesta en 10 km, radio ampliado a 15 km',
        },
      ),
    },
    {
      id: 'OT-1003',
      clienteId: 'CLI-03',
      clienteNombre: 'María Torres',
      categoriaServicio: 'REFRIGERACION',
      estado: 'FINALIZADA',
      tecnicoId: 'TEC-02',
      tecnicoNombre: 'Jorge Salas',
      direccion: 'Cra 8 #3-11',
      barrio: 'Villa del Rosario',
      descripcionFalla: 'Nevera no congela.',
      creadaEn: haceHoras(30),
      actualizadaEn: haceHoras(20),
      tarifaVisita: TARIFA_VISITA,
      radioKm: 10,
      presupuesto: { total: 95000, detalle: 'Cambio de termostato y recarga de gas' },
      diagnostico: {
        fallaDetectada: 'Termostato dañado',
        observaciones: 'Se reemplazó el termostato y se recargó gas R600a.',
        costoManoObra: 60000,
        costoRepuestos: 35000,
      },
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(30) },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: haceHoras(30) },
        {
          estado: 'ASIGNADA',
          actor: 'SISTEMA',
          fecha: haceHoras(29),
          motivo: 'Jorge Salas aceptó la oferta',
        },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: haceHoras(28) },
        {
          estado: 'EN_DIAGNOSTICO',
          actor: 'TECNICO',
          fecha: haceHoras(26),
          motivo: 'Termostato dañado',
        },
        {
          estado: 'EN_REPARACION',
          actor: 'CLIENTE',
          fecha: haceHoras(25),
          motivo: 'Presupuesto aprobado',
        },
        {
          estado: 'FINALIZADA',
          actor: 'TECNICO',
          fecha: haceHoras(20),
          motivo: 'Servicio finalizado',
        },
      ),
    },
    {
      id: 'OT-1004',
      clienteId: 'CLI-04',
      clienteNombre: 'Diego Ramírez',
      categoriaServicio: 'ELECTRODOMESTICOS',
      estado: 'SOLICITADA',
      tecnicoId: null,
      tecnicoNombre: null,
      direccion: 'Calle 15 #8-32',
      barrio: 'Caobos',
      descripcionFalla: 'Lavadora no centrifuga.',
      creadaEn: haceHoras(0),
      actualizadaEn: haceHoras(0),
      tarifaVisita: 0,
      radioKm: 10,
      presupuesto: null,
      diagnostico: null,
      historial: historial({ estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(0) }),
    },
    {
      id: 'OT-1005',
      clienteId: 'CLI-05',
      clienteNombre: 'Sofía Herrera',
      categoriaServicio: 'AIRE_ACONDICIONADO',
      estado: 'EN_DIAGNOSTICO',
      tecnicoId: 'TEC-01',
      tecnicoNombre: 'Carlos Ruiz',
      direccion: 'Av. Cero #20-10',
      barrio: 'El Prado',
      descripcionFalla: 'Aire acondicionado hace ruido fuerte al encender.',
      creadaEn: haceHoras(6),
      actualizadaEn: haceHoras(2),
      tarifaVisita: 0,
      radioKm: 10,
      presupuesto: { total: 210000, detalle: 'Cambio de motor del ventilador' },
      diagnostico: {
        fallaDetectada: 'Rodamiento del motor desgastado',
        observaciones: 'Se recomienda reemplazar el motor del ventilador interior.',
        costoManoObra: 90000,
        costoRepuestos: 120000,
      },
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(6) },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: haceHoras(6) },
        { estado: 'ASIGNADA', actor: 'SISTEMA', fecha: haceHoras(5) },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: haceHoras(4) },
        {
          estado: 'EN_DIAGNOSTICO',
          actor: 'TECNICO',
          fecha: haceHoras(2),
          motivo: 'Rodamiento del motor desgastado',
        },
      ),
    },
    {
      id: 'OT-1006',
      clienteId: 'CLI-06',
      clienteNombre: 'Andrés Castillo',
      categoriaServicio: 'REFRIGERACION',
      estado: 'EN_REPARACION',
      tecnicoId: 'TEC-02',
      tecnicoNombre: 'Jorge Salas',
      direccion: 'Calle 7 #2-18',
      barrio: 'La Merced',
      descripcionFalla: 'Cuarto frío pierde temperatura.',
      creadaEn: haceHoras(10),
      actualizadaEn: haceHoras(3),
      tarifaVisita: 0,
      radioKm: 10,
      presupuesto: { total: 320000, detalle: 'Cambio de compresor' },
      diagnostico: {
        fallaDetectada: 'Compresor sin presión',
        observaciones: 'Se aprueba reemplazo del compresor.',
        costoManoObra: 120000,
        costoRepuestos: 200000,
      },
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(10) },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: haceHoras(10) },
        { estado: 'ASIGNADA', actor: 'SISTEMA', fecha: haceHoras(9) },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: haceHoras(8) },
        {
          estado: 'EN_DIAGNOSTICO',
          actor: 'TECNICO',
          fecha: haceHoras(6),
          motivo: 'Compresor sin presión',
        },
        {
          estado: 'EN_REPARACION',
          actor: 'CLIENTE',
          fecha: haceHoras(3),
          motivo: 'Presupuesto aprobado',
        },
      ),
    },
    {
      id: 'OT-1007',
      clienteId: 'CLI-07',
      clienteNombre: 'Paula Mendoza',
      categoriaServicio: 'ELECTRICIDAD',
      estado: 'DISPUTADA',
      tecnicoId: 'TEC-03',
      tecnicoNombre: 'Camila Pardo',
      direccion: 'Calle 3 #14-02',
      barrio: 'San Luis',
      descripcionFalla: 'Instalación de tomacorrientes nuevos.',
      creadaEn: haceHoras(48),
      actualizadaEn: haceHoras(24),
      tarifaVisita: TARIFA_VISITA,
      radioKm: 10,
      presupuesto: { total: 180000, detalle: 'Materiales e instalación' },
      diagnostico: {
        fallaDetectada: 'Cableado antiguo',
        observaciones: 'Se sugiere reemplazo total del cableado.',
        costoManoObra: 100000,
        costoRepuestos: 80000,
      },
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(48) },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: haceHoras(48) },
        { estado: 'ASIGNADA', actor: 'SISTEMA', fecha: haceHoras(47) },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: haceHoras(46) },
        { estado: 'EN_DIAGNOSTICO', actor: 'TECNICO', fecha: haceHoras(40) },
        {
          estado: 'DISPUTADA',
          actor: 'CLIENTE',
          fecha: haceHoras(24),
          motivo: 'El cliente no está de acuerdo con el valor del presupuesto',
        },
      ),
    },
    {
      id: 'OT-1008',
      clienteId: 'CLI-08',
      clienteNombre: 'Ricardo Silva',
      categoriaServicio: 'ELECTRODOMESTICOS',
      estado: 'SIN_TECNICOS_DISPONIBLES',
      tecnicoId: null,
      tecnicoNombre: null,
      direccion: 'Anillo Vial #200-5',
      barrio: 'Zona Franca',
      descripcionFalla: 'Microondas no calienta.',
      creadaEn: haceHoras(20),
      actualizadaEn: haceHoras(19),
      tarifaVisita: 0,
      radioKm: 25,
      presupuesto: null,
      diagnostico: null,
      historial: historial(
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: haceHoras(20) },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: haceHoras(20) },
        {
          estado: 'SIN_TECNICOS_DISPONIBLES',
          actor: 'SISTEMA',
          fecha: haceHoras(19),
          motivo: 'Ningún técnico aceptó dentro de los 60 s en 25 km',
        },
      ),
    },
  ];
}

function copiar(ot: OrdenTrabajo): OrdenTrabajo {
  return structuredClone(ot);
}

@Injectable({ providedIn: 'root' })
export class OtMockService {
  private ordenes: OrdenTrabajo[] = crearDatosIniciales();
  private siguienteConsecutivo = 1009;

  obtenerTodas(): Observable<OrdenTrabajo[]> {
    return this.responder(() => this.ordenes.map(copiar));
  }

  obtenerPorId(id: string): Observable<OrdenTrabajo> {
    return this.responder(() => copiar(this.buscar(id)));
  }

  crear(request: CrearOrdenTrabajoRequest): Observable<OrdenTrabajo> {
    return this.responder(() => {
      const ahora = new Date().toISOString();
      const nueva: OrdenTrabajo = {
        id: `OT-${this.siguienteConsecutivo++}`,
        clienteId: request.clienteId,
        clienteNombre: request.clienteNombre,
        categoriaServicio: request.categoriaServicio,
        estado: 'BUSCANDO_TECNICO',
        tecnicoId: null,
        tecnicoNombre: null,
        direccion: request.direccion,
        barrio: request.barrio,
        descripcionFalla: request.descripcionFalla,
        creadaEn: ahora,
        actualizadaEn: ahora,
        tarifaVisita: 0,
        radioKm: 10,
        presupuesto: null,
        diagnostico: null,
        historial: historial(
          { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: ahora, motivo: 'Solicitud creada' },
          {
            estado: 'BUSCANDO_TECNICO',
            actor: 'SISTEMA',
            fecha: ahora,
            motivo: 'Difusión a técnicos en 10 km',
          },
        ),
      };
      this.ordenes = [nueva, ...this.ordenes];
      return copiar(nueva);
    });
  }

  asignarTecnico(id: string, tecnicoNombre?: string): Observable<OrdenTrabajo> {
    return this.responder(() => {
      const ot = this.buscar(id);
      const tecnico =
        TECNICOS_DISPONIBLES.find((t) => t.nombre === tecnicoNombre) ?? this.tecnicoLibre(ot);
      return this.avanzar(id, 'ASIGNADA', 'SISTEMA', `${tecnico.nombre} aceptó la oferta`, {
        tecnicoId: tecnico.id,
        tecnicoNombre: tecnico.nombre,
      });
    });
  }

  iniciarDesplazamiento(id: string): Observable<OrdenTrabajo> {
    return this.responder(() =>
      this.avanzar(id, 'EN_CAMINO', 'TECNICO', 'El técnico inició el desplazamiento'),
    );
  }

  registrarDiagnostico(id: string, request: DiagnosticoRequest): Observable<OrdenTrabajo> {
    return this.responder(() => {
      const diagnostico = { ...request };
      const presupuesto = {
        total: request.costoManoObra + request.costoRepuestos,
        detalle: request.observaciones ?? request.fallaDetectada,
      };
      return this.avanzar(
        id,
        'EN_DIAGNOSTICO',
        'TECNICO',
        `Diagnóstico: ${request.fallaDetectada}`,
        {
          diagnostico,
          presupuesto,
        },
      );
    });
  }

  aprobarPresupuesto(id: string): Observable<OrdenTrabajo> {
    return this.responder(() =>
      this.avanzar(id, 'EN_REPARACION', 'CLIENTE', 'Presupuesto aprobado'),
    );
  }

  rechazarPresupuesto(id: string, motivo?: string): Observable<OrdenTrabajo> {
    return this.responder(() =>
      this.avanzar(id, 'DISPUTADA', 'CLIENTE', motivo ?? 'El cliente rechazó el presupuesto'),
    );
  }

  finalizar(id: string): Observable<OrdenTrabajo> {
    return this.responder(() => this.avanzar(id, 'FINALIZADA', 'TECNICO', 'Servicio finalizado'));
  }

  cancelar(id: string, actor: ActorOt, motivo: string): Observable<OrdenTrabajo> {
    return this.responder(() => {
      const ot = this.buscar(id);
      const viajo = ot.estado === 'EN_CAMINO' || ot.estado === 'EN_DIAGNOSTICO';
      return this.avanzar(id, 'CANCELADA', actor, motivo, {
        tarifaVisita: viajo ? TARIFA_VISITA : 0,
      });
    });
  }

  resolverDisputa(id: string, conAcuerdo: boolean, motivo: string): Observable<OrdenTrabajo> {
    return this.responder(() =>
      this.avanzar(
        id,
        conAcuerdo ? 'FINALIZADA' : 'CANCELADA',
        'ADMINISTRADOR',
        motivo,
        conAcuerdo ? {} : { tarifaVisita: 0 },
      ),
    );
  }

  private avanzar(
    id: string,
    hacia: EstadoOt,
    actor: ActorOt,
    motivo?: string,
    cambios: Partial<OrdenTrabajo> = {},
  ): OrdenTrabajo {
    const actual = this.buscar(id);
    if (!puedeTransicionar(actual.estado, hacia)) {
      throw new Error(`Transición no permitida: ${actual.estado} → ${hacia}`);
    }
    const ahora = new Date().toISOString();
    const actualizada: OrdenTrabajo = {
      ...actual,
      ...cambios,
      estado: hacia,
      actualizadaEn: ahora,
      historial: [...actual.historial, { estado: hacia, actor, fecha: ahora, motivo }],
    };
    this.ordenes = this.ordenes.map((ot) => (ot.id === id ? actualizada : ot));
    return copiar(actualizada);
  }

  private buscar(id: string): OrdenTrabajo {
    const ot = this.ordenes.find((orden) => orden.id === id);
    if (!ot) {
      throw new Error(`No existe la orden de trabajo ${id}`);
    }
    return ot;
  }

  private tecnicoLibre(ot: OrdenTrabajo): { id: string; nombre: string } {
    const ocupados = new Set(
      this.ordenes
        .filter((orden) => orden.estado !== 'FINALIZADA' && orden.estado !== 'CANCELADA')
        .map((orden) => orden.tecnicoNombre),
    );
    return (
      TECNICOS_DISPONIBLES.find((tecnico) => !ocupados.has(tecnico.nombre)) ?? {
        id: ot.tecnicoId ?? 'TEC-00',
        nombre: TECNICOS_DISPONIBLES[0].nombre,
      }
    );
  }

  private responder<T>(operacion: () => T): Observable<T> {
    return of(undefined).pipe(
      delay(LATENCIA_MS),
      map(() => operacion()),
    );
  }
}
