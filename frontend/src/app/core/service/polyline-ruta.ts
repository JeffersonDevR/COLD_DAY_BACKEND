/**
 * Decodes the encoded polyline the backend returns from Google Directions.
 *
 * The loader already fetches the `geometry` library
 * (`google-maps-loader.ts`: `libraries=geometry,places`), so
 * `google.maps.geometry.encoding.decodePath` is available once the map is up.
 *
 * Failure is normal here and must never break the map: the string may be empty
 * (Google answered without geometry), the script may not be loaded yet, or the
 * payload may be malformed. Every one of those paths returns `null` and the
 * caller keeps drawing the straight line.
 */
export function decodificarRuta(
  codificada: string | null | undefined,
): google.maps.LatLngLiteral[] | null {
  if (!codificada) return null;

  const win = window as unknown as {
    google?: {
      maps?: {
        geometry?: {
          encoding?: {
            decodePath?: (encoded: string) => google.maps.LatLng[] | undefined;
          };
        };
      };
    };
  };
  const decodePath = win.google?.maps?.geometry?.encoding?.decodePath;
  if (typeof decodePath !== 'function') return null;

  try {
    const puntos = decodePath(codificada);
    if (!Array.isArray(puntos) || puntos.length < 2) return null;
    return puntos.map((punto) => ({ lat: punto.lat(), lng: punto.lng() }));
  } catch {
    // A malformed polyline is a rendering detail, not a page error.
    return null;
  }
}
