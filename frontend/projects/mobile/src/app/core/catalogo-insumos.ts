import { Injectable } from '@angular/core';
import { CategoriaServicio } from '@core/models/common.models';

/**
 * Catálogo de insumos para el diagnóstico del técnico (B3).
 *
 * MOCK aprobado por el dueño del producto (2026-11-23): el backend todavía no
 * expone catálogo de proveedores (ver docs/design/renovacion-reglas-stitch.md
 * §2, fila "Selección de insumo desde catálogo"). Cuando exista el endpoint,
 * este servicio se reemplaza por la llamada real sin tocar la pantalla.
 *
 * Sin precios a propósito: el DTO de línea de insumo no trae precio y pintar
 * uno sería inventar dinero (PRODUCT.md). Solo nombre y unidad de despacho.
 */
export interface ProductoCatalogo {
  id: string;
  nombre: string;
  /** Categoría a la que sirve normalmente; 'GENERAL' aplica a todas. */
  categoria: CategoriaServicio | 'GENERAL';
  unidad: string;
}

export const CATALOGO_INSUMOS_MOCK: readonly ProductoCatalogo[] = [
  { id: 'gas-r410a', nombre: 'Gas refrigerante R410A 900 g', categoria: 'AIRE_ACONDICIONADO', unidad: 'cilindro' },
  { id: 'gas-r134a', nombre: 'Gas refrigerante R134a 450 g', categoria: 'REFRIGERACION', unidad: 'cilindro' },
  { id: 'gas-r600a', nombre: 'Gas refrigerante R600a 150 g', categoria: 'REFRIGERACION', unidad: 'cilindro' },
  { id: 'capacitor-35', nombre: 'Capacitor 35 µF 440 V', categoria: 'AIRE_ACONDICIONADO', unidad: 'unidad' },
  { id: 'capacitor-50', nombre: 'Capacitor 50 µF 440 V', categoria: 'AIRE_ACONDICIONADO', unidad: 'unidad' },
  { id: 'contactor-2p', nombre: 'Contactor 2 polos 30 A', categoria: 'ELECTRICIDAD', unidad: 'unidad' },
  { id: 'breaker-20', nombre: 'Breaker 20 A', categoria: 'ELECTRICIDAD', unidad: 'unidad' },
  { id: 'cable-12', nombre: 'Cable THHN #12 (metro)', categoria: 'ELECTRICIDAD', unidad: 'metro' },
  { id: 'termostato', nombre: 'Termostato de nevera', categoria: 'REFRIGERACION', unidad: 'unidad' },
  { id: 'relay-ptc', nombre: 'Relé PTC de compresor', categoria: 'REFRIGERACION', unidad: 'unidad' },
  { id: 'filtro-secador', nombre: 'Filtro secador 1/4', categoria: 'REFRIGERACION', unidad: 'unidad' },
  { id: 'valvula-servicio', nombre: 'Válvula de servicio 1/4', categoria: 'REFRIGERACION', unidad: 'unidad' },
  { id: 'bomba-drain', nombre: 'Bomba de drenaje de lavadora', categoria: 'LAVADORAS', unidad: 'unidad' },
  { id: 'correa-lavadora', nombre: 'Correa de lavadora', categoria: 'LAVADORAS', unidad: 'unidad' },
  { id: 'resistencia', nombre: 'Resistencia de nevera', categoria: 'REFRIGERACION', unidad: 'unidad' },
  { id: 'cinta-aislante', nombre: 'Cinta aislante', categoria: 'GENERAL', unidad: 'rollo' },
  { id: 'soldadura-plata', nombre: 'Varilla de soldadura de plata', categoria: 'GENERAL', unidad: 'varilla' },
];

/** Búsqueda rápida del catálogo (máx. 6 resultados, sin acentos ni mayúsculas). */
@Injectable({ providedIn: 'root' })
export class CatalogoInsumosService {
  buscar(termino: string, categoria?: CategoriaServicio): ProductoCatalogo[] {
    const tokens = this.normalizar(termino.trim()).split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens[0].length < 2) return [];
    return CATALOGO_INSUMOS_MOCK.filter((p) => {
      if (p.categoria !== 'GENERAL' && categoria && p.categoria !== categoria) return false;
      const nombre = this.normalizar(p.nombre);
      // Cada palabra debe aparecer: "gas r410" encuentra "Gas refrigerante R410A".
      return tokens.every((token) => nombre.includes(token));
    }).slice(0, 6);
  }

  private normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
