import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';
import { gpx } from '@tmcw/togeojson';
import * as turf from '@turf/turf';

// ¡IMPORTANTE! Reemplaza esto con tu token público de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWxiY2FtaW5hIiwiYSI6ImNtdGl2bXRvODA0eHcyd3MzNTNhamt3c2wifQ.ULvpbbYOEpd_apVFvEWp7g';

if (MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
  document.getElementById('token-warning').style.display = 'block';
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12', // Estilo inicial
    center: [-119.5383, 37.7431],
    zoom: 13,
    pitch: 70, 
    bearing: 41 
  });

  // Ruta por defecto
  const route = {
    'type': 'FeatureCollection',
    'features': [
      {
        'type': 'Feature',
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [-119.5383, 37.7431],
            [-119.5350, 37.7450],
            [-119.5320, 37.7445],
            [-119.5280, 37.7410],
            [-119.5250, 37.7380],
            [-119.5200, 37.7350],
            [-119.5100, 37.7320],
            [-119.4950, 37.7280],
          ]
        }
      }
    ]
  };

  // Variables para la animación
  let animationFrame = null;
  let currentGeojsonRoute = route;
  
  // Variables del reproductor
  let isPlaying = false;
  let currentDistance = 0;
  let routeDistance = 0;
  let lineToFollow = null;
  let speed = 0;
  let speedMultiplier = 1;

  const playBtn = document.getElementById('play-btn');
  const timeline = document.getElementById('timeline');
  const speedSelector = document.getElementById('speed-selector');
  const styleSelector = document.getElementById('style-selector');

  // Activar controles iniciales
  playBtn.disabled = false;
  timeline.disabled = false;
  speedSelector.disabled = false;

  // Función para re-añadir las capas 3D y la ruta cada vez que cambie el mapa base
  function addCustomLayers() {
    // Relieve 3D
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
    }

    // Cielo atmosférico
    if (!map.getLayer('sky')) {
      map.addLayer({
        'id': 'sky',
        'type': 'sky',
        'paint': {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });
    }

    // Capa de la ruta
    if (!map.getSource('route')) {
      map.addSource('route', {
        'type': 'geojson',
        'data': currentGeojsonRoute,
        'lineMetrics': true 
      });

      map.addLayer({
        'id': 'route-line',
        'type': 'line',
        'source': 'route',
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'paint': {
          'line-color': '#fc4c02', // Color Naranja Strava
          'line-width': 8,
          'line-opacity': 0.9
        }
      });
    } else {
      // Si ya existía, simplemente nos aseguramos de que tenga los datos correctos
      map.getSource('route').setData(currentGeojsonRoute);
    }
  }

  // Al cargar el mapa y cada vez que cambia el estilo (capa base)
  map.on('style.load', () => {
    addCustomLayers();
  });

  // Cambiar capa base
  if(styleSelector) {
    styleSelector.addEventListener('change', (e) => {
      map.setStyle(e.target.value);
    });
  }

  // --- LÓGICA DE CÁMARA Y REPRODUCTOR ---

  function updateCamera() {
    if (!lineToFollow) return;
    
    const currentPoint = turf.along(lineToFollow, currentDistance, {units: 'kilometers'});
    
    const nextDistance = Math.min(currentDistance + speed * 10, routeDistance);
    const nextPoint = turf.along(lineToFollow, nextDistance, {units: 'kilometers'});
    const bearing = turf.bearing(currentPoint, nextPoint);

    map.jumpTo({
      center: currentPoint.geometry.coordinates,
      bearing: bearing,
      pitch: 75,
      zoom: 15.5 
    });

    if (routeDistance > 0) {
      timeline.value = (currentDistance / routeDistance) * 100;
    }
  }

  function animate() {
    if (!isPlaying) return;

    currentDistance += (speed * speedMultiplier);
    if (currentDistance >= routeDistance) {
      currentDistance = routeDistance;
      isPlaying = false;
      playBtn.innerText = '▶';
      updateCamera();
      return;
    }

    updateCamera();
    animationFrame = requestAnimationFrame(animate);
  }

  // Lógica para leer archivos GPX
  document.getElementById('gpx-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = new DOMParser().parseFromString(event.target.result, 'text/xml');
      const geojson = gpx(xml);
      currentGeojsonRoute = geojson;
      
      // Reiniciar estado
      lineToFollow = null;
      currentDistance = 0;
      timeline.value = 0;
      isPlaying = false;
      playBtn.innerText = '▶';
      if (animationFrame) cancelAnimationFrame(animationFrame);

      // Si el mapa ya cargó, actualizamos los datos
      if (map.isStyleLoaded() && map.getSource('route')) {
        map.getSource('route').setData(currentGeojsonRoute);
      }

      // Calcular bounding box
      const bounds = new mapboxgl.LngLatBounds();
      let hasCoords = false;

      geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'LineString') {
          feature.geometry.coordinates.forEach(coord => {
            bounds.extend(coord);
            hasCoords = true;
          });
        } else if (feature.geometry && feature.geometry.type === 'MultiLineString') {
          feature.geometry.coordinates.forEach(line => {
            line.forEach(coord => {
              bounds.extend(coord);
              hasCoords = true;
            });
          });
        }
      });

      if (hasCoords) {
        map.fitBounds(bounds, {
          padding: 50,
          pitch: 70,
          bearing: map.getBearing(),
          maxZoom: 14 
        });
      }
    };
    reader.readAsText(file);
  });

  // Lógica de Controles de "Modo Vídeo"
  playBtn.addEventListener('click', () => {
    if (!currentGeojsonRoute) return;

    if (!lineToFollow) {
      const routeFeature = currentGeojsonRoute.features.find(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');
      if (!routeFeature) return;

      lineToFollow = routeFeature;
      if (routeFeature.geometry.type === 'MultiLineString') {
        lineToFollow = { type: 'Feature', geometry: { type: 'LineString', coordinates: routeFeature.geometry.coordinates[0] } };
      }

      routeDistance = turf.length(lineToFollow, {units: 'kilometers'});
      speed = routeDistance / 1800; 
    }

    isPlaying = !isPlaying;
    
    if (isPlaying) {
      playBtn.innerText = '⏸';
      if (currentDistance >= routeDistance) {
        currentDistance = 0;
      }
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animate();
    } else {
      playBtn.innerText = '▶';
      if (animationFrame) cancelAnimationFrame(animationFrame);
    }
  });

  timeline.addEventListener('input', (e) => {
    if (!lineToFollow) {
      const routeFeature = currentGeojsonRoute.features.find(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');
      if (!routeFeature) return;
      lineToFollow = routeFeature.geometry.type === 'MultiLineString' 
        ? { type: 'Feature', geometry: { type: 'LineString', coordinates: routeFeature.geometry.coordinates[0] } } 
        : routeFeature;
      routeDistance = turf.length(lineToFollow, {units: 'kilometers'});
      speed = routeDistance / 1800;
    }

    const percent = parseFloat(e.target.value);
    currentDistance = (percent / 100) * routeDistance;
    
    isPlaying = false;
    playBtn.innerText = '▶';
    if (animationFrame) cancelAnimationFrame(animationFrame);
    
    updateCamera();
  });

  speedSelector.addEventListener('change', (e) => {
    speedMultiplier = parseFloat(e.target.value);
  });
}
