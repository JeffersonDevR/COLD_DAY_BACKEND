import { Injectable, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import {
  UsuarioResponse,
  TecnicoResponse,
  OtResponse,
  OfertaTecnicoResponse,
  LiquidacionResponse,
  DisputaResponse,
  LeadCotizacion,
  EstadoOt,
  EstadoOperativo,
  EstadoValidacion,
  DiagnosticoRequest,
  MedioPago,
  ActorOt,
  CategoriaServicio,
  TipoDocumentoTecnico,
  DocumentoTecnico,
} from '../../domain/models/common.models';

@Injectable({
  providedIn: 'root'
})
export class MockDbService {
  // --- USUARIOS ---
  readonly usuarios = signal<UsuarioResponse[]>([
    {
      id: 1,
      nombre: 'Carlos Méndez',
      correo: 'carlos.admin@coldday.com.co',
      telefono: '3104567890',
      rol: 'ADMINISTRADOR',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-01-10',
    },
    {
      id: 2,
      nombre: 'Ana Martínez',
      correo: 'ana.contable@coldday.com.co',
      telefono: '3156789012',
      rol: 'CONTABLE',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-02-01',
    },
    {
      id: 3,
      nombre: 'María Gómez',
      correo: 'maria.gomez@gmail.com',
      telefono: '3187654321',
      rol: 'CLIENTE',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-03-05',
    },
    {
      id: 4,
      nombre: 'Roberto Torres',
      correo: 'roberto.torres@gmail.com',
      telefono: '3129876543',
      rol: 'CLIENTE',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-03-12',
    },
    {
      id: 5,
      nombre: 'Lucía Mendoza',
      correo: 'lucia.mendoza@empresa.co',
      telefono: '3171122334',
      rol: 'CLIENTE',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-04-01',
    },
    {
      id: 6,
      nombre: 'Juan Pérez',
      correo: 'juan.tecnico@coldday.com.co',
      telefono: '3001234567',
      rol: 'TECNICO',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-01-15',
    },
    {
      id: 7,
      nombre: 'Diego Caicedo',
      correo: 'diego.tecnico@coldday.com.co',
      telefono: '3112345678',
      rol: 'TECNICO',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-01-20',
    },
    {
      id: 8,
      nombre: 'Andrés Silva',
      correo: 'andres.tecnico@coldday.com.co',
      telefono: '3133456789',
      rol: 'TECNICO',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-02-10',
    },
    {
      id: 9,
      nombre: 'Mateo Rivera',
      correo: 'mateo.tecnico@coldday.com.co',
      telefono: '3144567890',
      rol: 'TECNICO',
      habeasDataAceptado: true,
      activo: true,
      fechaRegistro: '2025-03-28',
    }
  ]);

  // --- TÉCNICOS ---
  readonly tecnicos = signal<TecnicoResponse[]>([
    {
      id: 'TEC-001',
      usuarioId: 6,
      nombre: 'Juan Pérez',
      nombreCompleto: 'Juan Pérez',
      cedula: '1090456789',
      correo: 'juan.tecnico@coldday.com.co',
      telefono: '3001234567',
      numeroIdentificacion: '1090456789',
      categorias: ['REFRIGERACION', 'AIRE_ACONDICIONADO'],
      categoriasServicio: ['REFRIGERACION', 'AIRE_ACONDICIONADO'],
      estadoOperativo: 'DISPONIBLE',
      estadoValidacion: 'APROBADO',
      activo: true,
      reputacion: 4.9,
      totalServicios: 68,
      serviciosCompletados: 68,
      deudaLiquidacion: 0,
      deudaComisionCop: 0,
      ubicacionActual: { latitud: 7.8939, longitud: -72.5078 }, // Cúcuta Centro
      certificaciones: [
        {
          nombre: 'Técnico Laboral en Refrigeración y Climatización',
          institucion: 'SENA Regional Norte de Santander',
          fechaObtencion: '2022-11-15',
          fechaVencimiento: '2028-11-15',
          estadoVigencia: 'VIGENTE'
        },
        {
          nombre: 'Manejo Seguro de Sustancias Refrigerantes',
          institucion: 'Unidad Técnica Ozono (UTO)',
          fechaObtencion: '2023-04-10',
          fechaVencimiento: '2027-04-10',
          estadoVigencia: 'VIGENTE'
        }
      ],
      documentos: [
        { id: 'DOC-1', tipo: 'CEDULA', nombre: 'Cedula_JuanPerez.pdf', estadoValidacion: 'APROBADO', semaforo: 'VERDE' },
        { id: 'DOC-2', tipo: 'ANTECEDENTES', nombre: 'Policia_Procuraduria.pdf', estadoValidacion: 'APROBADO', fechaVencimiento: '2026-12-31', semaforo: 'VERDE' },
        { id: 'DOC-3', tipo: 'CERTIFICACION_CONTE', nombre: 'Tarjeta_CONTE_TE1.pdf', estadoValidacion: 'APROBADO', fechaVencimiento: '2028-11-15', semaforo: 'VERDE' }
      ]
    },
    {
      id: 'TEC-002',
      usuarioId: 7,
      nombre: 'Diego Caicedo',
      nombreCompleto: 'Diego Caicedo',
      cedula: '1090123456',
      correo: 'diego.tecnico@coldday.com.co',
      telefono: '3112345678',
      numeroIdentificacion: '1090123456',
      categorias: ['AIRE_ACONDICIONADO', 'ELECTRICIDAD'],
      categoriasServicio: ['AIRE_ACONDICIONADO', 'ELECTRICIDAD'],
      estadoOperativo: 'BLOQUEADO_POR_LIQUIDACION', // Bloqueado por deuda de comisión
      estadoValidacion: 'APROBADO',
      activo: true,
      reputacion: 4.7,
      totalServicios: 45,
      serviciosCompletados: 45,
      deudaLiquidacion: 38000,
      deudaComisionCop: 38000,
      ubicacionActual: { latitud: 7.9022, longitud: -72.4921 }, // Cúcuta Guaimaral
      certificaciones: [
        {
          nombre: 'Instalación y Mantenimiento de Climatización',
          institucion: 'SENA Cúcuta',
          fechaObtencion: '2021-08-20',
          fechaVencimiento: '2027-08-20',
          estadoVigencia: 'VIGENTE'
        }
      ],
      documentos: [
        { id: 'DOC-4', tipo: 'CEDULA', nombre: 'Cedula_DiegoC.pdf', estadoValidacion: 'APROBADO', semaforo: 'VERDE' },
        { id: 'DOC-5', tipo: 'RUT', nombre: 'RUT_Actualizado.pdf', estadoValidacion: 'APROBADO', semaforo: 'VERDE' }
      ]
    },
    {
      id: 'TEC-003',
      usuarioId: 8,
      nombre: 'Andrés Silva',
      nombreCompleto: 'Andrés Silva',
      cedula: '1090987654',
      correo: 'andres.tecnico@coldday.com.co',
      telefono: '3133456789',
      numeroIdentificacion: '1090987654',
      categorias: ['ELECTRICIDAD', 'ELECTRODOMESTICOS'],
      categoriasServicio: ['ELECTRICIDAD', 'ELECTRODOMESTICOS'],
      estadoOperativo: 'DISPONIBLE',
      estadoValidacion: 'APROBADO',
      activo: true,
      reputacion: 4.8,
      totalServicios: 53,
      serviciosCompletados: 53,
      deudaLiquidacion: 0,
      deudaComisionCop: 0,
      ubicacionActual: { latitud: 7.8856, longitud: -72.4988 }, // Cúcuta La Riviera
      certificaciones: [
        {
          nombre: 'Técnico Electricista Matrícula Profesional CONTE TE-1',
          institucion: 'Consejo Nacional de Técnicos Electricistas (CONTE)',
          fechaObtencion: '2021-09-22',
          fechaVencimiento: '2026-09-22', // Por vencer en 7 días
          estadoVigencia: 'POR_VENCER'
        }
      ],
      documentos: [
        { id: 'DOC-6', tipo: 'CERTIFICACION_CONTE', nombre: 'CONTE_TE1_Silva.pdf', estadoValidacion: 'APROBADO', fechaVencimiento: '2026-09-22', semaforo: 'AMARILLO' }
      ]
    },
    {
      id: 'TEC-004',
      usuarioId: 9,
      nombre: 'Mateo Rivera',
      nombreCompleto: 'Mateo Rivera',
      cedula: '1090654321',
      correo: 'mateo.tecnico@coldday.com.co',
      telefono: '3144567890',
      numeroIdentificacion: '1090654321',
      categorias: ['ELECTRODOMESTICOS', 'REFRIGERACION'],
      categoriasServicio: ['ELECTRODOMESTICOS', 'REFRIGERACION'],
      estadoOperativo: 'FUERA_DE_SERVICIO',
      estadoValidacion: 'EN_REVISION', // Documentos pendientes de auditar
      motivoRechazoValidacion: 'En espera de revisión de antecedentes y RUT por parte del equipo administrativo.',
      activo: true,
      reputacion: 5.0,
      totalServicios: 0,
      serviciosCompletados: 0,
      deudaLiquidacion: 0,
      deudaComisionCop: 0,
      ubicacionActual: { latitud: 7.9155, longitud: -72.5122 }, // Cúcuta Prados del Norte
      certificaciones: [
        {
          nombre: 'Mantenimiento Electromecánico',
          institucion: 'SENA',
          fechaObtencion: '2024-06-15',
          fechaVencimiento: '2030-06-15',
          estadoVigencia: 'VIGENTE'
        }
      ],
      documentos: [
        { id: 'DOC-7', tipo: 'CEDULA', nombre: 'Cedula_Mateo_Rivera.pdf', estadoValidacion: 'EN_REVISION', semaforo: 'AMARILLO' },
        { id: 'DOC-8', tipo: 'ANTECEDENTES', nombre: 'Antecedentes_Judiciales.pdf', estadoValidacion: 'EN_REVISION', fechaVencimiento: '2027-01-01', semaforo: 'VERDE' }
      ]
    }
  ]);

  // --- ÓRDENES DE TRABAJO (OT) ---
  readonly ordenesTrabajo = signal<OtResponse[]>([
    {
      id: 'OT-2026-001',
      clienteId: '3',
      clienteNombre: 'María Gómez',
      clienteTelefono: '3187654321',
      tecnicoId: null,
      categoriaServicio: 'AIRE_ACONDICIONADO',
      descripcionFalla: 'Aire acondicionado mini-split 12.000 BTU gotea abundante agua hacia el interior de la habitación y emite un silbido agudo al arrancar el compresor.',
      direccion: 'Calle 13 # 2E-45, Barrio Caobos',
      barrio: 'Los Caobos',
      punto: { latitud: 7.8872, longitud: -72.4951 },
      estado: 'BUSCANDO_TECNICO',
      radioBusquedaKm: 10,
      tiempoRestanteBroadcastSec: 42,
      fechaCreacion: '2026-09-15T09:30:00Z',
      fechaActualizacion: '2026-09-15T09:30:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-15T09:30:00Z', motivo: 'Registro de solicitud por el cliente' },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: '2026-09-15T09:30:10Z', motivo: 'Broadcast iniciado en radio de 10 km (Cúcuta metropolitana)' }
      ]
    },
    {
      id: 'OT-2026-002',
      clienteId: '4',
      clienteNombre: 'Roberto Torres',
      clienteTelefono: '3129876543',
      tecnicoId: 'TEC-001',
      tecnicoNombre: 'Juan Pérez',
      tecnicoTelefono: '3001234567',
      tecnicoReputacion: 4.9,
      categoriaServicio: 'REFRIGERACION',
      descripcionFalla: 'Nevera no Frost Haceb 380L no enfría en el compartimiento inferior y acumula escarcha sólida en el congelador.',
      direccion: 'Av. 4 # 11-20, Barrio Guaimaral',
      barrio: 'Guaimaral',
      punto: { latitud: 7.9045, longitud: -72.4977 },
      estado: 'EN_DIAGNOSTICO',
      radioBusquedaKm: 10,
      diagnostico: {
        fallaDetectada: 'Ventilador forzador del difusor quemado y bimetálico de descongelación abierto, impidiendo el flujo de frío al conservador inferior.',
        observaciones: 'Se requiere desmonte de panel interior, sustitución de bimetal y lubricación de ducto de drenaje.',
        costoManoObra: 85000,
        costoRepuestos: 65000,
        repuestosSugeridos: ['Bimetálico universal L55', 'Ventilador difusor 110V Haceb'],
        tiempoEstimadoMinutos: 90
      },
      presupuesto: {
        aprobado: false,
        manoObra: 85000,
        repuestos: 65000,
        total: 150000
      },
      fechaCreacion: '2026-09-15T08:15:00Z',
      fechaActualizacion: '2026-09-15T09:10:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-15T08:15:00Z' },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: '2026-09-15T08:15:15Z' },
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha: '2026-09-15T08:16:30Z', motivo: 'Aceptada por Juan Pérez' },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: '2026-09-15T08:25:00Z' },
        { estado: 'EN_DIAGNOSTICO', actor: 'TECNICO', fecha: '2026-09-15T08:45:00Z' }
      ]
    },
    {
      id: 'OT-2026-003',
      clienteId: '5',
      clienteNombre: 'Lucía Mendoza',
      clienteTelefono: '3171122334',
      tecnicoId: 'TEC-003',
      tecnicoNombre: 'Andrés Silva',
      tecnicoTelefono: '3133456789',
      tecnicoReputacion: 4.8,
      categoriaServicio: 'ELECTRICIDAD',
      descripcionFalla: 'Disparo recurrente del totalizador principal y olor a recalentamiento en el tablero de distribución de la oficina.',
      direccion: 'Calle 8 # 0E-88, Barrio La Riviera',
      barrio: 'La Riviera',
      punto: { latitud: 7.8911, longitud: -72.4933 },
      estado: 'EN_REPARACION',
      diagnostico: {
        fallaDetectada: 'Breaker termo-magnético de 40A vencido por sobrecarga con terminales sulfatados y fase recalentada.',
        costoManoObra: 95000,
        costoRepuestos: 85000,
        repuestosSugeridos: ['Breaker Legrand 2x40A enchufable', 'Cable THHN #8 AWG 3 metros'],
        tiempoEstimadoMinutos: 60
      },
      presupuesto: {
        aprobado: true,
        manoObra: 95000,
        repuestos: 85000,
        total: 180000
      },
      fechaCreacion: '2026-09-15T07:45:00Z',
      fechaActualizacion: '2026-09-15T08:50:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-15T07:45:00Z' },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: '2026-09-15T07:45:20Z' },
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha: '2026-09-15T07:46:10Z' },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: '2026-09-15T08:00:00Z' },
        { estado: 'EN_DIAGNOSTICO', actor: 'TECNICO', fecha: '2026-09-15T08:20:00Z' },
        { estado: 'EN_REPARACION', actor: 'CLIENTE', fecha: '2026-09-15T08:35:00Z', motivo: 'Presupuesto aprobado por cliente' }
      ]
    },
    {
      id: 'OT-2026-004',
      clienteId: '4',
      clienteNombre: 'Roberto Torres',
      clienteTelefono: '3129876543',
      tecnicoId: 'TEC-002',
      tecnicoNombre: 'Diego Caicedo',
      tecnicoTelefono: '3112345678',
      tecnicoReputacion: 4.7,
      categoriaServicio: 'AIRE_ACONDICIONADO',
      descripcionFalla: 'Mantenimiento preventivo general y recarga de gas ecológico R-410A a split inverter de 18.000 BTU.',
      direccion: 'Mz C Lote 14, Urbanización Prados del Este',
      barrio: 'Prados del Este',
      punto: { latitud: 7.8722, longitud: -72.4811 },
      estado: 'FINALIZADA',
      diagnostico: {
        fallaDetectada: 'Serpentín condensador tapado por polvo y baja presión de 85 PSI (requirió presurización a 125 PSI).',
        costoManoObra: 110000,
        costoRepuestos: 70000,
        repuestosSugeridos: ['Lata Refrigerante R410A 1kg', 'Limpiador desengrasante dieléctrico'],
        tiempoEstimadoMinutos: 120
      },
      presupuesto: {
        aprobado: true,
        manoObra: 110000,
        repuestos: 70000,
        total: 180000
      },
      firmaClienteUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 50 Q 50 10 90 50 T 170 50" fill="none" stroke="%230F172A" stroke-width="2"/></svg>',
      actaGarantiaGenerada: true,
      garantiaDias: 90,
      calificacion: {
        estrellas: 5,
        comentario: 'Excelente servicio, muy puntual y el aire quedó enfriando perfecto.',
        fecha: '2026-09-14T17:00:00Z'
      },
      fechaCreacion: '2026-09-14T14:00:00Z',
      fechaActualizacion: '2026-09-14T16:45:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-14T14:00:00Z' },
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha: '2026-09-14T14:05:00Z' },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: '2026-09-14T14:20:00Z' },
        { estado: 'EN_DIAGNOSTICO', actor: 'TECNICO', fecha: '2026-09-14T14:40:00Z' },
        { estado: 'EN_REPARACION', actor: 'CLIENTE', fecha: '2026-09-14T14:50:00Z' },
        { estado: 'FINALIZADA', actor: 'TECNICO', fecha: '2026-09-14T16:45:00Z', motivo: 'Servicio concluido, pago en efectivo recibido' }
      ]
    },
    {
      id: 'OT-2026-005',
      clienteId: '3',
      clienteNombre: 'María Gómez',
      clienteTelefono: '3187654321',
      tecnicoId: 'TEC-001',
      tecnicoNombre: 'Juan Pérez',
      tecnicoTelefono: '3001234567',
      categoriaServicio: 'ELECTRODOMESTICOS',
      descripcionFalla: 'Lavadora Whirlpool carga frontal 18kg bloqueada con código de error F21 en el panel de control durante el drenado.',
      direccion: 'Av. Gran Colombia # 6E-24',
      barrio: 'Los Caobos',
      punto: { latitud: 7.8902, longitud: -72.4965 },
      estado: 'DISPUTADA',
      diagnostico: {
        fallaDetectada: 'Bomba de expulsión atascada con restos de monedas y filtro de drenaje obstruido.',
        costoManoObra: 75000,
        costoRepuestos: 95000,
        repuestosSugeridos: ['Bomba de drenaje magnética Whirlpool']
      },
      presupuesto: {
        aprobado: false,
        manoObra: 75000,
        repuestos: 95000,
        total: 170000
      },
      fechaCreacion: '2026-09-13T10:00:00Z',
      fechaActualizacion: '2026-09-14T11:20:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-13T10:00:00Z' },
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha: '2026-09-13T10:04:00Z' },
        { estado: 'EN_DIAGNOSTICO', actor: 'TECNICO', fecha: '2026-09-13T11:00:00Z' },
        { estado: 'DISPUTADA', actor: 'CLIENTE', fecha: '2026-09-13T11:25:00Z', motivo: 'Cliente objetó cobro de repuesto nuevo al considerar que era solo destape' }
      ]
    },
    {
      id: 'OT-2026-006',
      clienteId: '3',
      clienteNombre: 'María Gómez',
      clienteTelefono: '3187654321',
      tecnicoId: 'TEC-001',
      tecnicoNombre: 'Juan Pérez',
      tecnicoTelefono: '3001234567',
      tecnicoReputacion: 4.9,
      categoriaServicio: 'REFRIGERACION',
      descripcionFalla: 'Congelador comercial vertical para helados marca Indufrial no baja de -5°C, condensador calienta en exceso.',
      direccion: 'Calle 10 # 3-15, Centro',
      barrio: 'Centro',
      punto: { latitud: 7.8928, longitud: -72.5052 },
      estado: 'EN_CAMINO',
      radioBusquedaKm: 10,
      fechaCreacion: '2026-09-15T09:00:00Z',
      fechaActualizacion: '2026-09-15T09:12:00Z',
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-09-15T09:00:00Z' },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha: '2026-09-15T09:00:10Z' },
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha: '2026-09-15T09:02:15Z', motivo: 'Aceptada por Juan Pérez' },
        { estado: 'EN_CAMINO', actor: 'TECNICO', fecha: '2026-09-15T09:12:00Z', motivo: 'Técnico inició desplazamiento hacia la ubicación' }
      ]
    }
  ]);

  // --- OFERTAS PARA TÉCNICOS ---
  readonly ofertas = signal<OfertaTecnicoResponse[]>([
    {
      id: 'OFERTA-001',
      otId: 'OT-2026-001',
      ot: this.ordenesTrabajo()[0],
      tecnicoId: 'TEC-001',
      distanciaKm: 3.4,
      radioVigenteKm: 10,
      segundosRestantes: 42,
      estado: 'PENDIENTE',
      fechaCreacion: '2026-09-15T09:30:10Z'
    }
  ]);

  // --- LIQUIDACIONES ---
  readonly liquidaciones = signal<LiquidacionResponse[]>([
    {
      id: 'LIQ-001',
      otId: 'OT-2026-004',
      tecnicoId: 'TEC-002',
      tecnicoNombre: 'Diego Caicedo',
      montoServicio: 180000,
      comision: 18000, // 10% de $180.000
      estado: 'PENDIENTE_CONSIGNACION', // Deuda pendiente -> causa bloqueo
      medioPago: 'EFECTIVO',
      fechaRegistro: '2026-09-14T16:50:00Z',
      motivoRechazo: undefined
    },
    {
      id: 'LIQ-002',
      otId: 'OT-2026-003',
      tecnicoId: 'TEC-003',
      tecnicoNombre: 'Andrés Silva',
      montoServicio: 250000,
      comision: 25000,
      estado: 'EN_VERIFICACION',
      medioPago: 'TRANSFERENCIA',
      comprobanteUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop',
      referenciaBancaria: 'NEQUI-CONSIGNACION-883920',
      fechaRegistro: '2026-09-14T11:00:00Z'
    },
    {
      id: 'LIQ-003',
      otId: 'OT-2026-000',
      tecnicoId: 'TEC-001',
      tecnicoNombre: 'Juan Pérez',
      montoServicio: 320000,
      comision: 32000,
      estado: 'APROBADA',
      medioPago: 'TRANSFERENCIA',
      comprobanteUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop',
      referenciaBancaria: 'BANCOLOMBIA-TRANS-1049281',
      fechaRegistro: '2026-09-12T14:30:00Z',
      fechaVerificacion: '2026-09-12T16:00:00Z'
    }
  ]);

  // --- DISPUTAS ---
  readonly disputas = signal<DisputaResponse[]>([
    {
      id: 'DISP-001',
      otId: 'OT-2026-005',
      clienteNombre: 'María Gómez',
      tecnicoNombre: 'Juan Pérez',
      motivo: 'Cliente manifiesta inconformidad con el diagnóstico: afirma que el técnico presupuestó cambio de bomba nueva ($95.000) cuando solo requería retiro de monedas atascadas.',
      estado: 'ABIERTA',
      fechaApertura: '2026-09-13T11:25:00Z'
    }
  ]);

  // --- LEADS COTIZACIÓN B2B ---
  readonly leads = signal<LeadCotizacion[]>([
    {
      id: 'LEAD-001',
      empresa: 'Clínica Santa Ana de Cúcuta',
      contacto: 'Ing. Fernando Páez',
      correo: 'mantenimiento@clinicasantaana.com',
      telefono: '3158901234',
      categoriaServicio: 'AIRE_ACONDICIONADO',
      cantidadEquipos: 14,
      descripcion: 'Mantenimiento trimestral para sistemas centrales Fan-Coil y Chiller en área de quirófanos.',
      fecha: '2026-09-14',
      atendido: false
    },
    {
      id: 'LEAD-002',
      empresa: 'Supermercados Los Montes',
      contacto: 'Gloria Suárez',
      correo: 'compras@losmontes.com.co',
      telefono: '3167894561',
      categoriaServicio: 'REFRIGERACION',
      cantidadEquipos: 6,
      descripcion: 'Revisión y mantenimiento de vitrinas refrigeradas y cuartos fríos de carnes.',
      fecha: '2026-09-13',
      atendido: true
    }
  ]);

  // ================= MÉTODOS OPERATIVOS =================

  crearOt(nuevaOt: {
    clienteId: string;
    clienteNombre: string;
    clienteTelefono?: string;
    categoriaServicio: CategoriaServicio;
    descripcionFalla: string;
    direccion: string;
    barrio?: string;
    latitud: number;
    longitud: number;
    evidenciaUrls?: string[];
  }): OtResponse {
    const nextIdNumber = this.ordenesTrabajo().length + 1;
    const pad = nextIdNumber < 10 ? `00${nextIdNumber}` : `0${nextIdNumber}`;
    const id = `OT-2026-${pad}`;

    const fecha = new Date().toISOString();
    const ot: OtResponse = {
      id,
      clienteId: nuevaOt.clienteId,
      clienteNombre: nuevaOt.clienteNombre,
      clienteTelefono: nuevaOt.clienteTelefono || '3100000000',
      tecnicoId: null,
      categoriaServicio: nuevaOt.categoriaServicio,
      descripcionFalla: nuevaOt.descripcionFalla,
      direccion: nuevaOt.direccion,
      barrio: nuevaOt.barrio || 'Cúcuta',
      punto: { latitud: nuevaOt.latitud, longitud: nuevaOt.longitud },
      estado: 'BUSCANDO_TECNICO',
      radioBusquedaKm: 10,
      tiempoRestanteBroadcastSec: 60,
      evidenciaUrls: nuevaOt.evidenciaUrls,
      fechaCreacion: fecha,
      fechaActualizacion: fecha,
      historial: [
        { estado: 'SOLICITADA', actor: 'CLIENTE', fecha, motivo: 'Solicitud creada en plataforma' },
        { estado: 'BUSCANDO_TECNICO', actor: 'SISTEMA', fecha, motivo: 'Broadcast iniciado en radio inicial de 10 km' }
      ]
    };

    // Agregar a OTs
    this.ordenesTrabajo.update(list => [ot, ...list]);

    // Generar oferta broadcast para técnicos disponibles
    const tecnicosDisponibles = this.tecnicos().filter(
      t => t.estadoOperativo === 'DISPONIBLE' &&
           t.estadoValidacion === 'APROBADO' &&
           t.categoriasServicio?.includes(ot.categoriaServicio)
    );

    const nuevasOfertas = tecnicosDisponibles.map((tec, idx) => ({
      id: `OFERTA-${Date.now()}-${idx}`,
      otId: ot.id,
      ot,
      tecnicoId: tec.id,
      distanciaKm: 2.5 + idx * 1.8,
      radioVigenteKm: 10,
      segundosRestantes: 60,
      estado: 'PENDIENTE' as const,
      fechaCreacion: fecha
    }));

    if (nuevasOfertas.length > 0) {
      this.ofertas.update(list => [...nuevasOfertas, ...list]);
    }

    return ot;
  }

  aceptarOferta(ofertaId: string, tecnicoId: string): boolean {
    const oferta = this.ofertas().find(o => o.id === ofertaId && o.estado === 'PENDIENTE');
    if (!oferta) return false;

    const tecnico = this.tecnicos().find(t => t.id === tecnicoId);
    if (!tecnico || tecnico.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') return false;

    const fecha = new Date().toISOString();

    // Actualizar OT
    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === oferta.otId) {
          return {
            ...ot,
            estado: 'ASIGNADA',
            tecnicoId: tecnico.id,
            tecnicoNombre: tecnico.nombre,
            tecnicoTelefono: tecnico.telefono,
            tecnicoReputacion: tecnico.reputacion,
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              { estado: 'ASIGNADA', actor: 'TECNICO', fecha, motivo: `Oferta aceptada por ${tecnico.nombre}` },
              {
                estado: 'ASIGNADA',
                actor: 'SISTEMA',
                fecha,
                motivo: `Cargo de visita + diagnóstico notificado al cliente: $${(environment.diagnosticoPrecio + environment.transportePrecio).toLocaleString('es-CO')} COP (diagnóstico $${environment.diagnosticoPrecio.toLocaleString('es-CO')} + transporte $${environment.transportePrecio.toLocaleString('es-CO')})`
              }
            ]
          };
        }
        return ot;
      })
    );

    // Invalidar todas las ofertas de esta OT (primer técnico gana)
    this.ofertas.update(list =>
      list.map(o => {
        if (o.otId === oferta.otId) {
          return { ...o, estado: o.id === ofertaId ? 'ACEPTADA' : 'CANCELADA' };
        }
        return o;
      })
    );

    // Cambiar estado operativo del técnico a OCUPADO
    this.tecnicos.update(list =>
      list.map(t => (t.id === tecnicoId ? { ...t, estadoOperativo: 'OCUPADO' } : t))
    );

    return true;
  }

  avanzarEstadoOt(otId: string, nuevoEstado: EstadoOt, actor: ActorOt, motivo?: string): void {
    const fecha = new Date().toISOString();
    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          return {
            ...ot,
            estado: nuevoEstado,
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              { estado: nuevoEstado, actor, fecha, motivo }
            ]
          };
        }
        return ot;
      })
    );
  }

  registrarDiagnostico(otId: string, diag: DiagnosticoRequest): void {
    const fecha = new Date().toISOString();
    const manoObra = diag.costoManoObra ?? diag.manoDeObra ?? 0;
    const repuestos = diag.costoRepuestos ?? diag.repuestos ?? 0;
    const cargoDiagnostico = environment.diagnosticoPrecio;
    const cargoTransporte = environment.transportePrecio;
    // `total` es solo la reparación (mano de obra + repuestos); la visita y el
    // diagnóstico son un cargo aparte (constantes de environment).
    const total = manoObra + repuestos;

    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          return {
            ...ot,
            diagnostico: diag,
            presupuesto: {
              aprobado: false,
              manoObra,
              repuestos,
              total,
              cargoDiagnostico,
              cargoTransporte
            },
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              {
                estado: ot.estado,
                actor: 'TECNICO',
                fecha,
                motivo: `Diagnóstico emitido: $${total.toLocaleString('es-CO')} COP de reparación (Mano de obra: $${manoObra.toLocaleString('es-CO')}, Repuestos: $${repuestos.toLocaleString('es-CO')}) + $${(cargoDiagnostico + cargoTransporte).toLocaleString('es-CO')} de visita/diagnóstico`
              }
            ]
          };
        }
        return ot;
      })
    );
  }

  aprobarPresupuesto(otId: string): void {
    const fecha = new Date().toISOString();
    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          return {
            ...ot,
            estado: 'EN_REPARACION',
            presupuesto: ot.presupuesto ? { ...ot.presupuesto, aprobado: true } : undefined,
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              { estado: 'EN_REPARACION', actor: 'CLIENTE', fecha, motivo: 'Presupuesto formalmente aprobado por el cliente' }
            ]
          };
        }
        return ot;
      })
    );
  }

  rechazarPresupuesto(otId: string, motivo: string): void {
    const fecha = new Date().toISOString();
    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          return {
            ...ot,
            estado: 'DISPUTADA',
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              { estado: 'DISPUTADA', actor: 'CLIENTE', fecha, motivo: `Presupuesto objetado: ${motivo}` }
            ]
          };
        }
        return ot;
      })
    );

    // Crear disputa en bandeja
    const ot = this.ordenesTrabajo().find(o => o.id === otId);
    this.disputas.update(list => [
      {
        id: `DISP-${Date.now()}`,
        otId,
        clienteNombre: ot?.clienteNombre || 'Cliente',
        tecnicoNombre: ot?.tecnicoNombre || 'Técnico',
        motivo,
        estado: 'ABIERTA',
        fechaApertura: fecha
      },
      ...list
    ]);
  }

  finalizarOtConPago(
    otId: string,
    medioPago: MedioPago,
    firmaDataUrl?: string
  ): void {
    const fecha = new Date().toISOString();
    let totalCobrado = 150000;
    let tecId: string | null = null;

    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          totalCobrado = ot.presupuesto?.total || 150000;
          tecId = ot.tecnicoId || null;
          return {
            ...ot,
            estado: 'FINALIZADA',
            actaGarantiaGenerada: true,
            garantiaDias: 90,
            firmaClienteUrl: firmaDataUrl || 'firma-digitalizada-ok',
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              {
                estado: 'FINALIZADA',
                actor: 'TECNICO',
                fecha,
                motivo: `Servicio finalizado con recaudo en ${medioPago}. Acta de garantía emitida.`
              }
            ]
          };
        }
        return ot;
      })
    );

    // Calcular comisión de plataforma según la tasa configurada (15% por defecto)
    const comision = Math.round(totalCobrado * environment.commissionRate);

    // Generar liquidación
    if (tecId) {
      const tecnico = this.tecnicos().find(t => t.id === tecId);
      const nuevaLiq: LiquidacionResponse = {
        id: `LIQ-${Date.now().toString().slice(-4)}`,
        otId,
        tecnicoId: tecId,
        tecnicoNombre: tecnico?.nombre || 'Técnico',
        montoServicio: totalCobrado,
        comision,
        estado: 'PENDIENTE_CONSIGNACION',
        medioPago,
        fechaRegistro: fecha
      };

      this.liquidaciones.update(list => [nuevaLiq, ...list]);

      // Según reglas: "Al finalizar en efectivo/transferencia, se calcula la comisión
      // y el técnico queda Bloqueado por Liquidación Pendiente hasta que el Admin apruebe el comprobante"
      this.tecnicos.update(list =>
        list.map(t => {
          if (t.id === tecId) {
            return {
              ...t,
              estadoOperativo: 'BLOQUEADO_POR_LIQUIDACION',
              deudaLiquidacion: (t.deudaLiquidacion || 0) + comision
            };
          }
          return t;
        })
      );
    }
  }

  cancelarOt(otId: string, motivo: string, actor: ActorOt): void {
    const fecha = new Date().toISOString();
    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          return {
            ...ot,
            estado: 'CANCELADA',
            fechaActualizacion: fecha,
            historial: [
              ...(ot.historial || []),
              { estado: 'CANCELADA', actor, fecha, motivo }
            ]
          };
        }
        return ot;
      })
    );

    // Si el técnico estaba asignado, liberarlo a DISPONIBLE si no está bloqueado
    const ot = this.ordenesTrabajo().find(o => o.id === otId);
    if (ot?.tecnicoId) {
      this.tecnicos.update(list =>
        list.map(t => {
          if (t.id === ot.tecnicoId && t.estadoOperativo === 'OCUPADO') {
            return { ...t, estadoOperativo: 'DISPONIBLE' };
          }
          return t;
        })
      );
    }
  }

  calificarOt(otId: string, estrellas: number, comentario: string): void {
    const fecha = new Date().toISOString();
    let tecId: string | null = null;

    this.ordenesTrabajo.update(list =>
      list.map(ot => {
        if (ot.id === otId) {
          tecId = ot.tecnicoId || null;
          return {
            ...ot,
            calificacion: { estrellas, comentario, fecha }
          };
        }
        return ot;
      })
    );

    // Recalcular reputación mock del técnico
    if (tecId) {
      this.tecnicos.update(list =>
        list.map(t => {
          if (t.id === tecId) {
            const serv = (t.totalServicios || 1) + 1;
            const currentRep = t.reputacion || 5.0;
            const nuevaRep = Number(((currentRep * (serv - 1) + estrellas) / serv).toFixed(1));
            return { ...t, reputacion: nuevaRep, totalServicios: serv };
          }
          return t;
        })
      );
    }
  }

  subirComprobanteLiquidacion(liqId: string, comprobanteUrl: string, referencia: string): void {
    this.liquidaciones.update(list =>
      list.map(l => {
        if (l.id === liqId) {
          return {
            ...l,
            estado: 'EN_VERIFICACION',
            comprobanteUrl,
            referenciaBancaria: referencia,
            fechaVerificacion: new Date().toISOString()
          };
        }
        return l;
      })
    );
  }

  aprobarLiquidacion(liqId: string): void {
    let tecId: string | null = null;
    let comisionMonto = 0;

    this.liquidaciones.update(list =>
      list.map(l => {
        if (l.id === liqId) {
          tecId = l.tecnicoId;
          comisionMonto = l.comision;
          return {
            ...l,
            estado: 'APROBADA',
            fechaVerificacion: new Date().toISOString()
          };
        }
        return l;
      })
    );

    // Descontar deuda y si llega a 0, desbloquear al técnico
    if (tecId) {
      this.tecnicos.update(list =>
        list.map(t => {
          if (t.id === tecId) {
            const nuevaDeuda = Math.max(0, (t.deudaLiquidacion || 0) - comisionMonto);
            const nuevoEstado = nuevaDeuda === 0 ? 'DISPONIBLE' : 'BLOQUEADO_POR_LIQUIDACION';
            return {
              ...t,
              deudaLiquidacion: nuevaDeuda,
              estadoOperativo: nuevoEstado
            };
          }
          return t;
        })
      );
    }
  }

  rechazarLiquidacion(liqId: string, motivo: string): void {
    this.liquidaciones.update(list =>
      list.map(l => {
        if (l.id === liqId) {
          return {
            ...l,
            estado: 'RECHAZADA',
            motivoRechazo: motivo,
            fechaVerificacion: new Date().toISOString()
          };
        }
        return l;
      })
    );
  }

  resolverDisputa(disputaId: string, resolucion: string, acuerdo: boolean, adminNombre: string): void {
    const fecha = new Date().toISOString();
    let otIdTarget: string | null = null;

    this.disputas.update(list =>
      list.map(d => {
        if (d.id === disputaId) {
          otIdTarget = d.otId;
          return {
            ...d,
            estado: acuerdo ? 'RESUELTA_CON_ACUERDO' : 'RESUELTA_SIN_ACUERDO',
            resolucion,
            fechaResolucion: fecha,
            resueltoPor: adminNombre
          };
        }
        return d;
      })
    );

    // Si acuerdo -> OT pasa a FINALIZADA; si sin acuerdo -> CANCELADA
    if (otIdTarget) {
      const nuevoEstado: EstadoOt = acuerdo ? 'FINALIZADA' : 'CANCELADA';
      this.avanzarEstadoOt(
        otIdTarget,
        nuevoEstado,
        'ADMINISTRADOR',
        `Disputa resuelta (${acuerdo ? 'Con acuerdo' : 'Sin acuerdo'}): ${resolucion}`
      );
    }
  }

  validarTecnico(tecnicoId: string, nuevoEstado: EstadoValidacion, motivoRechazo?: string): void {
    this.tecnicos.update(list =>
      list.map(t => {
        if (t.id === tecnicoId) {
          return {
            ...t,
            estadoValidacion: nuevoEstado,
            motivoRechazoValidacion: motivoRechazo,
            estadoOperativo: nuevoEstado === 'APROBADO' ? 'DISPONIBLE' : 'FUERA_DE_SERVICIO'
          };
        }
        return t;
      })
    );
  }

  cambiarDisponibilidadTecnico(tecnicoId: string, estado: EstadoOperativo): boolean {
    const tec = this.tecnicos().find(t => t.id === tecnicoId);
    if (!tec) return false;

    // Si tiene deuda pendiente, no puede ponerse en DISPONIBLE
    if (estado === 'DISPONIBLE' && (tec.deudaLiquidacion || 0) > 0) {
      return false; // Bloqueado por liquidación
    }

    this.tecnicos.update(list =>
      list.map(t => (t.id === tecnicoId ? { ...t, estadoOperativo: estado } : t))
    );
    return true;
  }

  guardarLeadCotizacion(lead: Omit<LeadCotizacion, 'id' | 'fecha' | 'atendido'>): void {
    const nuevo: LeadCotizacion = {
      ...lead,
      id: `LEAD-${Date.now().toString().slice(-4)}`,
      fecha: new Date().toISOString().slice(0, 10),
      atendido: false
    };
    this.leads.update(l => [nuevo, ...l]);
  }

  aceptarOt(otId: string, tecnicoId: string): OtResponse {
    const tecnico = this.tecnicos().find(t => t.id === tecnicoId);
    if (!tecnico || tecnico.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
      throw new Error('Técnico bloqueado o no encontrado');
    }

    const ot = this.ordenesTrabajo().find(o => o.id === otId);
    if (!ot) {
      throw new Error('Orden de trabajo no encontrada');
    }

    const fecha = new Date().toISOString();
    const otActualizada: OtResponse = {
      ...ot,
      estado: 'ASIGNADA',
      tecnicoId: tecnico.id,
      tecnicoNombre: tecnico.nombre,
      tecnicoTelefono: tecnico.telefono,
      tecnicoReputacion: tecnico.reputacion,
      fechaActualizacion: fecha,
      historial: [
        ...(ot.historial || []),
        { estado: 'ASIGNADA', actor: 'TECNICO', fecha, motivo: `Oferta aceptada por ${tecnico.nombre}` }
      ]
    };

    this.ordenesTrabajo.update(list => list.map(o => o.id === otId ? otActualizada : o));
    this.tecnicos.update(list => list.map(t => t.id === tecnicoId ? { ...t, estadoOperativo: 'OCUPADO' } : t));
    return otActualizada;
  }

  subirDocumentoTecnico(tecnicoId: string, tipo: TipoDocumentoTecnico, archivoUrl: string, fechaVencimiento?: string, nombre?: string): void {
    this.tecnicos.update(list =>
      list.map(t => {
        if (t.id === tecnicoId) {
          const doc: DocumentoTecnico = {
            id: `DOC-${Date.now()}`,
            tipo,
            nombre: nombre || `${tipo}_documento.pdf`,
            archivoUrl,
            fechaVencimiento,
            estadoValidacion: 'PENDIENTE',
            semaforo: 'AMARILLO'
          };
          return {
            ...t,
            documentos: [...(t.documentos || []), doc]
          };
        }
        return t;
      })
    );
  }
}
