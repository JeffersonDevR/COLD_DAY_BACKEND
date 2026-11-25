import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MapaConfigService } from '../service/mapa-config.service';
import { GoogleMotor } from './google-motor';
import { MAPA_MOTOR } from './mapa-motor.token';

function motorPara(proveedor: string) {
  TestBed.configureTestingModule({
    providers: [{ provide: MapaConfigService, useValue: { proveedor: signal(proveedor) } }],
  });
  return TestBed.inject(MAPA_MOTOR);
}

describe('MAPA_MOTOR', () => {
  it('con proveedor google entrega el motor de Google', () => {
    expect(motorPara('google')).toBeInstanceOf(GoogleMotor);
  });

  it('con un proveedor aún sin motor cae a Google', () => {
    expect(motorPara('mapbox')).toBeInstanceOf(GoogleMotor);
  });

  it('con un proveedor vacío cae a Google', () => {
    expect(motorPara('')).toBeInstanceOf(GoogleMotor);
  });
});
