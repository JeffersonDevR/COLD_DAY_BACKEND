import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MapaConfigService } from '../service/mapa-config.service';
import { GoogleMotor } from './google-motor';
import { MAPA_MOTOR } from './mapa-motor.token';

/** El motor de Google falso: registra cuándo se le pide cargar. */
function googleFalso(eventos: string[]) {
  return {
    nombre: 'google',
    listo: signal(false),
    cargando: signal(false),
    cargar: vi.fn(() => {
      eventos.push('motor-cargar');
      return Promise.resolve(true);
    }),
    reintentar: vi.fn(() => Promise.resolve(true)),
    crear: vi.fn(),
  };
}

function montar(proveedor: string) {
  const eventos: string[] = [];
  const google = googleFalso(eventos);
  const config = {
    cargar: vi.fn(async () => {
      await Promise.resolve();
      eventos.push('config-cargada');
    }),
    proveedor: vi.fn(() => {
      eventos.push('leer-proveedor');
      return proveedor;
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MapaConfigService, useValue: config },
      { provide: GoogleMotor, useValue: google },
    ],
  });
  return { motor: TestBed.inject(MAPA_MOTOR), google, config, eventos };
}

describe('MAPA_MOTOR', () => {
  it('no lee el proveedor al inyectarse: espera a que llegue la configuración del backend', async () => {
    const { motor, config, eventos } = montar('google');

    expect(config.proveedor).not.toHaveBeenCalled();
    await motor.cargar();

    expect(eventos).toEqual(['config-cargada', 'leer-proveedor', 'motor-cargar']);
  });

  it('con proveedor google delega en el motor de Google', async () => {
    const { motor, google } = montar('google');

    await motor.cargar();

    expect(motor.nombre).toBe('google');
    expect(google.cargar).toHaveBeenCalledTimes(1);
  });

  it('con un proveedor aún sin motor cae a Google', async () => {
    const { motor, google } = montar('mapbox');

    await motor.cargar();

    expect(google.cargar).toHaveBeenCalledTimes(1);
  });

  it('con un proveedor vacío cae a Google', async () => {
    const { motor, google } = montar('');

    await motor.cargar();

    expect(google.cargar).toHaveBeenCalledTimes(1);
  });

  it('listo y cargando reflejan el motor elegido y, antes de elegirlo, "cargando" mientras llega la config', async () => {
    const { motor, google } = montar('google');
    expect(motor.listo()).toBe(false);

    const carga = motor.cargar();
    expect(motor.cargando()).toBe(true);
    await carga;

    google.listo.set(true);
    google.cargando.set(false);
    expect(motor.listo()).toBe(true);
    expect(motor.cargando()).toBe(false);
  });

  it('reintentar también espera la configuración y delega en el motor elegido', async () => {
    const { motor, google, config } = montar('google');

    await motor.reintentar();

    expect(config.cargar).toHaveBeenCalledTimes(1);
    expect(google.reintentar).toHaveBeenCalledTimes(1);
  });

  it('crear delega en el motor elegido y falla claro si aún no se eligió', async () => {
    const { motor, google } = montar('google');
    const el = document.createElement('div');
    const opciones = {
      centro: { lat: 1, lng: 2 }, zoom: 3, zoomMin: 1, zoomMax: 5,
      limites: { north: 2, south: 0, east: 2, west: 0 },
    };

    expect(() => motor.crear(el, opciones)).toThrow('El motor de mapa aún no está listo');

    await motor.cargar();
    motor.crear(el, opciones);
    expect(google.crear).toHaveBeenCalledWith(el, opciones);
  });
});
