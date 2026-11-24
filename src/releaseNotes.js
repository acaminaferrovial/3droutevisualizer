/**
 * Notas de versión de Route3D.
 * Para publicar una nueva versión en el futuro:
 * 1) Sube `APP_VERSION` (ej. '1.1.0').
 * 2) Añade el nuevo objeto al principio del array `RELEASE_NOTES`.
 * Automáticamente volverá a mostrarse una sola vez a cada usuario al entrar en la app.
 */
export const APP_VERSION = '1.0.0';

export const RELEASE_NOTES = [
  {
    version: '1.0.0',
    date: 'Noviembre 2026',
    title: 'Lanzamiento Route3D PRO',
    subtitle: 'Planificación meteorológica en movimiento, edición interactiva de rutas, presiones y seguridad privada.',
    highlights: [
      {
        tag: 'Nuevo',
        title: 'Planificador interactivo con meteo y viento en movimiento',
        description:
          'Diseña rutas arrastrando Inicio, Meta o cualquier punto intermedio, cierra rutas circulares, consulta viento relativo, rachas, temperatura, 6 gráficos sincronizados con el mapa, fuentes de agua en España y mejor hora de salida.'
      },
      {
        tag: 'Nuevo',
        title: 'Calculadora científica de presión de neumáticos',
        description:
          'Calcula la presión óptima delantera y trasera en BAR y PSI para Carretera, Gravel y MTB conectada directamente con tu peso y las bicicletas de tu garaje.'
      },
      {
        tag: 'Mejora',
        title: 'Altimetría real DEM y zoom automático en detalle',
        description:
          'Cálculo preciso de desnivel acumulado mediante histéresis y datos topográficos SRTM/Copernicus, con encuadre automático de la ruta al abrir cualquier actividad.'
      },
      {
        tag: 'Seguridad',
        title: 'Entorno 100% privado y listo para Garmin Edge 1040',
        description:
          'Acceso exclusivo mediante inicio de sesión, aislamiento completo de rutas, segmentos, garaje y perfil propio, además de clave privada en Mi Perfil para sincronizar datos en vivo con tu Edge 1040.'
      }
    ]
  }
];
