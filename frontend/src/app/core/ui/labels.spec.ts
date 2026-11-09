import {
  CategoriaServicio,
  EstadoDisputa,
  EstadoLiquidacion,
  EstadoOperativo,
  EstadoOt,
  EstadoRequerimiento,
  EstadoValidacion,
  MedioPago,
  Rol,
  TipoDocumentoProveedor,
  TipoDocumentoTecnico,
} from '../models/common.models';
import {
  categoriaLabel,
  documentoLabel,
  estadoBadgeLabel,
  estadoDisputaLabel,
  estadoLiquidacionLabel,
  estadoOperativoLabel,
  estadoOtLabel,
  estadoRequerimientoLabel,
  estadoValidacionLabel,
  medioPagoLabel,
  rolLabel,
} from './labels';

describe('labels', () => {
  it('traduce todos los estados de OT', () => {
    const casos: [EstadoOt, string][] = [
      ['SOLICITADA', 'Solicitada'],
      ['BUSCANDO_TECNICO', 'Buscando técnico'],
      ['ASIGNADA', 'Asignada'],
      ['EN_CAMINO', 'En camino'],
      ['EN_DIAGNOSTICO', 'En diagnóstico'],
      ['EN_REPARACION', 'En reparación'],
      ['FINALIZADA', 'Finalizada'],
      ['CANCELADA', 'Cancelada'],
      ['SIN_TECNICOS_DISPONIBLES', 'Sin técnicos disponibles'],
      ['DISPUTADA', 'En disputa'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoOtLabel(estado)).toBe(etiqueta));
  });

  it('traduce todos los estados operativos', () => {
    const casos: [EstadoOperativo, string][] = [
      ['DISPONIBLE', 'Disponible'],
      ['OCUPADO', 'En servicio'],
      ['FUERA_DE_SERVICIO', 'Fuera de servicio'],
      ['BLOQUEADO_POR_LIQUIDACION', 'Bloqueado por liquidación'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoOperativoLabel(estado)).toBe(etiqueta));
  });

  it('traduce todos los estados de validación', () => {
    const casos: [EstadoValidacion, string][] = [
      ['PENDIENTE', 'Pendiente'],
      ['EN_REVISION', 'En revisión'],
      ['APROBADO', 'Aprobado'],
      ['RECHAZADO', 'Rechazado'],
      ['SUSPENDIDO', 'Suspendido'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoValidacionLabel(estado)).toBe(etiqueta));
  });

  it('traduce todos los estados de liquidación', () => {
    const casos: [EstadoLiquidacion, string][] = [
      ['PENDIENTE_CONSIGNACION', 'Pendiente de consignación'],
      ['EN_VERIFICACION', 'En verificación'],
      ['APROBADA', 'Aprobada'],
      ['RECHAZADA', 'Rechazada'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoLiquidacionLabel(estado)).toBe(etiqueta));
  });

  it('traduce todos los estados de disputa', () => {
    const casos: [EstadoDisputa, string][] = [
      ['ABIERTA', 'Abierta'],
      ['RESUELTA_CON_ACUERDO', 'Resuelta con acuerdo'],
      ['RESUELTA_SIN_ACUERDO', 'Resuelta sin acuerdo'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoDisputaLabel(estado)).toBe(etiqueta));
  });

  it('traduce todos los estados de requerimiento', () => {
    const casos: [EstadoRequerimiento, string][] = [
      ['SOLICITADO', 'Solicitado'],
      ['ASIGNADO', 'Asignado'],
      ['ENTREGADO', 'Entregado'],
      ['SIN_PROVEEDOR', 'Sin proveedor'],
    ];
    casos.forEach(([estado, etiqueta]) => expect(estadoRequerimientoLabel(estado)).toBe(etiqueta));
  });

  it('traduce todas las categorías de servicio', () => {
    const casos: [CategoriaServicio, string][] = [
      ['CAMARAS_VIGILANCIA', 'Cámaras de vigilancia'],
      ['REFRIGERACION', 'Refrigeración'],
      ['AIRE_ACONDICIONADO', 'Aire acondicionado'],
      ['LAVADORAS', 'Lavadoras'],
      ['ELECTRICIDAD', 'Electricidad'],
    ];
    casos.forEach(([categoria, etiqueta]) => expect(categoriaLabel(categoria)).toBe(etiqueta));
  });

  it('traduce todos los tipos de documento de técnico y proveedor', () => {
    const casos: [TipoDocumentoTecnico | TipoDocumentoProveedor, string][] = [
      ['CEDULA', 'Cédula'],
      ['ANTECEDENTES', 'Antecedentes'],
      ['ANTECEDENTES_POLICIA', 'Antecedentes de policía'],
      ['CERTIFICACION_CONTE', 'Certificación CONTE'],
      ['CERTIFICACION_SENA', 'Certificación SENA'],
      ['MATRICULA_CONTE', 'Matrícula CONTE'],
      ['RUT', 'RUT'],
      ['OTRO', 'Otro'],
      ['CERTIFICADO', 'Certificado'],
    ];
    casos.forEach(([tipo, etiqueta]) => expect(documentoLabel(tipo)).toBe(etiqueta));
  });

  it('traduce todos los medios de pago', () => {
    const casos: [MedioPago, string][] = [
      ['EFECTIVO', 'Efectivo'],
      ['TRANSFERENCIA', 'Transferencia'],
    ];
    casos.forEach(([medio, etiqueta]) => expect(medioPagoLabel(medio)).toBe(etiqueta));
  });

  it('traduce todos los roles', () => {
    const casos: [Rol, string][] = [
      ['CLIENTE', 'Cliente'],
      ['TECNICO', 'Técnico'],
      ['ADMINISTRADOR', 'Administrador'],
      ['CONTABLE', 'Contable'],
      ['PROVEEDOR', 'Proveedor'],
    ];
    casos.forEach(([rol, etiqueta]) => expect(rolLabel(rol)).toBe(etiqueta));
  });

  it('no rompe si el backend estrena un estado', () => {
    expect(estadoOtLabel('EN_GARANTIA' as unknown as EstadoOt)).toBe('EN_GARANTIA');
  });

  it('despacha cada familia desde el badge compartido', () => {
    expect(estadoBadgeLabel('BUSCANDO_TECNICO')).toBe('Buscando técnico');
    expect(estadoBadgeLabel('BLOQUEADO_POR_LIQUIDACION')).toBe('Bloqueado por liquidación');
    expect(estadoBadgeLabel('EN_REVISION')).toBe('En revisión');
    expect(estadoBadgeLabel('PENDIENTE_CONSIGNACION')).toBe('Pendiente de consignación');
    expect(estadoBadgeLabel('RESUELTA_SIN_ACUERDO')).toBe('Resuelta sin acuerdo');
  });
});
