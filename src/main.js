import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';
import * as turf from '@turf/turf';

// ================= CONFIGURACIÓN MAPBOX =================
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || localStorage.getItem('MAPBOX_TOKEN') || '';

if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') {
  const tokenWarning = document.getElementById('token-warning');
  if (tokenWarning) tokenWarning.style.display = 'block';
}

mapboxgl.accessToken = MAPBOX_TOKEN;

// ================= ICONOS SVG =================
const ICONS = {
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  arrowRight: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  bike: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
  bikeSmall: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
  shoe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16v2a2 2 0 0 0 2 2h16v-3a4 4 0 0 0-4-4h-3l-3-5H7l-1 5-3 3Z"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
};

// ================= TEMA CLARO / OSCURO =================
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('route3d_theme', isDark ? 'dark' : 'light');

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
    btn.title = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  }

  if (currentActivity) {
    drawElevationProfile(currentActivity.elevationProfile || [], currentDistanceKm);
  }
}

// ================= ESTADO GLOBAL =================
let map = null;
let currentActivity = null;
let currentGeojsonRoute = null;
let lineToFollow = null;
let routeDistanceKm = 0;

// Estado del Reproductor y Modo de Visualización
let isPlaying = false;
let is3DMode = false;
let currentDistanceKm = 0;
let playbackSpeed = 0; // km por frame
let speedMultiplier = 1;
let animationFrame = null;
let athleteMarker = null;
let startMarker = null;
let finishMarker = null;

// Filtros y Ordenación
let activeSportFilter = 'all';
let activeGearFilter = 'all';
let activeDateFrom = '';
let activeDateTo = '';
let activeGearCategoryFilter = 'all';
let searchQuery = '';
let currentSort = 'startDate-desc';
let gearList = [];
let currentUser = null;

// Estado de Segmentos en el Visor 3D y Zona de Segmentos
let currentRouteSegments = [];
let activeHighlightedSegment = null;
let isSegmentCreatorOpen = false;
let segCreatorClickStage = 'start'; // 'start' o 'end'
let segStartMarker = null;
let segEndMarker = null;

// Mapa y estado de la Zona Segmentos (dibujo de segmentos ajustado al camino)
let segmentsMap = null;
let isSegmentsMap3D = false;
let isSnapToTrailEnabled = true;
let allSavedSegments = [];
let drawnWaypoints = []; // Puntos clicados por el usuario: [[lng, lat], ...]
let drawnWaypointsOnWay = []; // Booleano por cada punto: true si clicó sobre vía/camino, false si clicó fuera de calzada
let drawnLegs = []; // Array de tramos entre puntos: [ [[lng,lat], ...], ... ]
let drawnSegmentCoords = []; // Geometría completa concatenada siguiendo el camino: [[lng, lat, ele], ...]
let drawnVertexMarkers = [];
let selectedZoneSegmentId = null;

// Mapa y estado del Planificador de Rutas
let plannerMap = null;
let isPlanner3D = false;
let isPlannerSnapEnabled = true;
let plannerWaypoints = [];
let plannerWaypointsOnWay = [];
let plannerLegs = [];
let plannerCoords = []; // [[lng, lat, ele], ...]
let plannerElevationProfile = []; // [{distance, elevation, grade}, ...]
let plannerVertexMarkers = [];
let plannerKmMarkers = [];
let plannerWeatherMarkers = [];
let plannerWeatherCheckpoints = [];
let plannerBaseActivityId = null;
let allUserActivitiesCache = [];
let savedPlannedRoutes = [];
let activePlannedRouteId = null;
let plannerRouteColorMode = 'wind'; // 'wind' | 'temp' | 'grade' | 'rain'
let plannerActiveChartType = 'elevation'; // 'elevation' | 'wind' | 'temp' | 'rain' | 'humidity' | 'uv'
let plannerHoverMarker = null;
let isWaterSourcesVisible = false;
let isAddingWaterSourceMode = false;
let waterSourceMarkers = [];
let isCyclingHeatmapVisible = false;

// ================= AUTENTICACIÓN Y FETCH MULTI-USUARIO =================
function getAuthToken() {
  return localStorage.getItem('route3d_token') || '';
}

function setAuthSession(token, user) {
  if (token) {
    localStorage.setItem('route3d_token', token);
  } else {
    localStorage.removeItem('route3d_token');
  }
  currentUser = user || null;
  updateUserUI();
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !url.includes('/api/auth/login')) {
    setAuthSession(null, null);
    clearPrivateClientState();
    showAuthScreen(true);
  }
  return res;
}

function getInitials(name) {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

function clearPrivateClientState() {
  currentActivity = null;
  currentGeojsonRoute = null;
  lineToFollow = null;
  routeDistanceKm = 0;
  gearList = [];
  allSavedSegments = [];
  savedPlannedRoutes = [];
  allUserActivitiesCache = [];
  plannerWeatherCheckpoints = [];
  clearPlannerRoute();
  clearDrawnSegment();

  const actContainer = document.getElementById('activities-container');
  const gearContainer = document.getElementById('gear-container');
  const segList = document.getElementById('all-segments-list');
  const planList = document.getElementById('planned-routes-list');
  if (actContainer) actContainer.innerHTML = '';
  if (gearContainer) gearContainer.innerHTML = '';
  if (segList) segList.innerHTML = '';
  if (planList) planList.innerHTML = '';
}

function showAuthScreen(visible) {
  const screen = document.getElementById('auth-screen');
  document.body.classList.toggle('is-authenticated', !visible);
  if (screen) {
    screen.style.display = visible ? 'flex' : 'none';
  }
  if (visible) {
    const loginPass = document.getElementById('login-password');
    if (loginPass) loginPass.value = '';
  }
}

function updateUserUI() {
  if (!currentUser) return;

  const initials = getInitials(currentUser.name);
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');
  if (headerAvatar) headerAvatar.innerText = initials;
  if (headerName) headerName.innerText = currentUser.name.split(' ')[0];

  // Rellenar vista de Mi Perfil
  const avatarLg = document.getElementById('profile-avatar-lg');
  const displayName = document.getElementById('profile-display-name');
  const sportBadge = document.getElementById('profile-sport-badge');
  const displayMeta = document.getElementById('profile-display-meta');
  const displayBio = document.getElementById('profile-display-bio');

  if (avatarLg) avatarLg.innerText = initials;
  if (displayName) displayName.innerText = currentUser.name;
  if (sportBadge) {
    sportBadge.className = `sport-badge ${getSportBadgeClass(currentUser.primarySport)}`;
    sportBadge.innerText = getSportName(currentUser.primarySport);
  }
  if (displayMeta) {
    const parts = [currentUser.email, currentUser.location].filter(Boolean);
    displayMeta.innerText = parts.join(' · ');
  }
  if (displayBio) {
    displayBio.innerText = currentUser.bio || 'Sin biografía definida.';
  }

  // Mini stats fisiológicas
  const statWeight = document.getElementById('profile-stat-weight');
  const statFtp = document.getElementById('profile-stat-ftp');
  const statWpkg = document.getElementById('profile-stat-wpkg');
  const statMaxHr = document.getElementById('profile-stat-maxhr');

  if (statWeight) {
    statWeight.innerHTML = currentUser.weightKg ? `${currentUser.weightKg} <small>kg</small>` : `-- <small>kg</small>`;
  }
  if (statFtp) {
    statFtp.innerHTML = currentUser.ftpWatts ? `${currentUser.ftpWatts} <small>W</small>` : `-- <small>W</small>`;
  }
  if (statWpkg) {
    if (currentUser.ftpWatts && currentUser.weightKg && currentUser.weightKg > 0) {
      statWpkg.innerHTML = `${(currentUser.ftpWatts / currentUser.weightKg).toFixed(2)} <small>W/kg</small>`;
    } else {
      statWpkg.innerHTML = `-- <small>W/kg</small>`;
    }
  }
  if (statMaxHr) {
    statMaxHr.innerHTML = currentUser.maxHeartrate
      ? `${currentUser.maxHeartrate} <small>bpm</small>`
      : `-- <small>bpm</small>`;
  }

  // Rellenar inputs del formulario de Mi Perfil
  const profName = document.getElementById('prof-name');
  const profEmail = document.getElementById('prof-email');
  const profLocation = document.getElementById('prof-location');
  const profSport = document.getElementById('prof-sport');
  const profWeight = document.getElementById('prof-weight');
  const profFtp = document.getElementById('prof-ftp');
  const profMaxHr = document.getElementById('prof-maxhr');
  const profBio = document.getElementById('prof-bio');
  const profPass = document.getElementById('prof-password');

  if (profName) profName.value = currentUser.name || '';
  if (profEmail) profEmail.value = currentUser.email || '';
  if (profLocation) profLocation.value = currentUser.location || '';
  if (profSport) profSport.value = currentUser.primarySport || 'Ride';
  if (profWeight) profWeight.value = currentUser.weightKg ?? '';
  if (profFtp) profFtp.value = currentUser.ftpWatts ?? '';
  if (profMaxHr) profMaxHr.value = currentUser.maxHeartrate ?? '';
  if (profBio) profBio.value = currentUser.bio || '';
  if (profPass) profPass.value = '';

  // Estado de integración Garmin Edge 1040
  const garminUrlEl = document.getElementById('garmin-endpoint-url');
  const garminStatusEl = document.getElementById('garmin-key-status');
  const garminRevokeBtn = document.getElementById('garmin-revoke-key-btn');
  if (garminUrlEl) {
    garminUrlEl.innerText = `${window.location.origin}/api/garmin/live`;
  }
  if (garminStatusEl) {
    garminStatusEl.innerText = currentUser.hasGarminApiKey
      ? `Activa (${currentUser.garminApiKeyPrefix || 'r3d_***'})`
      : 'Sin clave activa';
  }
  if (garminRevokeBtn) {
    garminRevokeBtn.style.display = currentUser.hasGarminApiKey ? 'inline-flex' : 'none';
  }
}

// ================= FORMATEADORES =================
function formatDistance(meters) {
  if (!meters) return '0.00';
  return (meters / 1000).toFixed(2);
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function formatClock(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatPaceOrSpeed(speedKmh) {
  if (!speedKmh || speedKmh <= 0) {
    return '0.0 km/h';
  }
  return `${speedKmh.toFixed(1)} km/h`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getSportName(type) {
  switch (type) {
    case 'Ride': return 'Carretera';
    case 'MountainBikeRide': return 'MTB';
    case 'GravelRide': return 'Gravel';
    case 'VirtualRide': return 'Rodillo / TT';
    default: return 'Ciclismo';
  }
}

function getSportBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('mountain')) return 'trail';
  if (t.includes('gravel')) return 'run';
  if (t.includes('virtual')) return 'hike';
  return 'ride';
}

function setPlayButtonState(playing) {
  const playBtn = document.getElementById('play-btn');
  if (!playBtn) return;
  playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
  playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
}

// ================= INICIALIZACIÓN MAPBOX =================
function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || !MAPBOX_TOKEN) return;

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-3.2681, 40.5658], // Azuqueca de Henares, Guadalajara
    zoom: 13,
    pitch: 0,
    bearing: 0
  });

  // Marcador del atleta
  const el = document.createElement('div');
  el.className = 'athlete-map-marker';
  el.style.width = '14px';
  el.style.height = '14px';
  el.style.backgroundColor = '#f24e1e';
  el.style.border = '3px solid #ffffff';
  el.style.borderRadius = '50%';
  el.style.boxShadow = '0 2px 10px rgba(17, 19, 24, 0.35)';

  athleteMarker = new mapboxgl.Marker({ element: el });

  map.on('style.load', () => {
    addCustomTerrainAndRoute();
    if (currentActivity && document.getElementById('tab-viewer')?.classList.contains('active')) {
      fitViewerMapToCurrentRoute({ duration: 600 });
    }
  });

  // Clic en el mapa para fijar inicio/fin del segmento cuando el creador de segmentos está abierto
  map.on('click', (e) => {
    if (!isSegmentCreatorOpen || !lineToFollow || routeDistanceKm <= 0) return;
    const clickedPt = turf.point([e.lngLat.lng, e.lngLat.lat]);
    const snapped = turf.nearestPointOnLine(lineToFollow, clickedPt, { units: 'kilometers' });
    const distKm = Number((snapped.properties.location || 0).toFixed(2));

    const startSlider = document.getElementById('seg-start-slider');
    const endSlider = document.getElementById('seg-end-slider');
    if (!startSlider || !endSlider) return;

    if (segCreatorClickStage === 'start') {
      startSlider.value = Math.min(distKm, Math.max(0, routeDistanceKm - 0.15));
      if (parseFloat(endSlider.value) <= parseFloat(startSlider.value) + 0.1) {
        endSlider.value = Math.min(routeDistanceKm, parseFloat(startSlider.value) + 0.8);
      }
      segCreatorClickStage = 'end';
    } else {
      if (distKm <= parseFloat(startSlider.value) + 0.05) {
        startSlider.value = Math.max(0, distKm - 0.5);
      }
      endSlider.value = Math.max(parseFloat(startSlider.value) + 0.1, distKm);
      segCreatorClickStage = 'start';
    }
    updateSegmentCreatorPreview();
  });

  const styleSelector = document.getElementById('style-selector');
  if (styleSelector) {
    styleSelector.addEventListener('change', (e) => {
      if (map) map.setStyle(e.target.value);
    });
  }
}

function getCurrentRouteBounds() {
  if (
    currentActivity?.bounds &&
    typeof currentActivity.bounds.minLng === 'number' &&
    typeof currentActivity.bounds.minLat === 'number' &&
    typeof currentActivity.bounds.maxLng === 'number' &&
    typeof currentActivity.bounds.maxLat === 'number'
  ) {
    const b = currentActivity.bounds;
    return [
      [b.minLng, b.minLat],
      [b.maxLng, b.maxLat]
    ];
  }
  if (lineToFollow) {
    try {
      const bbox = turf.bbox(lineToFollow);
      if (bbox && bbox.length === 4 && bbox.every((n) => Number.isFinite(n))) {
        return [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]]
        ];
      }
    } catch {
      return null;
    }
  }
  return null;
}

function fitViewerMapToCurrentRoute({ duration = 850 } = {}) {
  if (!map) return;
  const bounds = getCurrentRouteBounds();
  if (!bounds) return;

  map.resize();
  map.fitBounds(bounds, {
    padding: { top: 80, bottom: 155, left: 64, right: 64 },
    pitch: is3DMode ? 65 : 0,
    bearing: is3DMode ? 35 : 0,
    maxZoom: 15.5,
    duration
  });
}

function set3DMode(active, { skipFit = false } = {}) {
  is3DMode = active;
  const toggleBtn = document.getElementById('toggle-3d-btn');
  const toggleText = document.getElementById('toggle-3d-text');

  if (is3DMode) {
    if (toggleBtn) toggleBtn.classList.add('active');
    if (toggleText) toggleText.innerText = 'Vista 2D';

    if (map) {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      map.easeTo({
        pitch: 68,
        bearing: 35,
        duration: 1100
      });
    }
  } else {
    if (toggleBtn) toggleBtn.classList.remove('active');
    if (toggleText) toggleText.innerText = 'Vista 3D';

    if (map) {
      map.setTerrain(null);
      if (!skipFit) {
        const bounds = getCurrentRouteBounds();
        if (bounds) {
          fitViewerMapToCurrentRoute({ duration: 900 });
        } else {
          map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
        }
      }
    }
  }
}

function addCustomTerrainAndRoute() {
  if (!map) return;

  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }

  if (is3DMode) {
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  } else {
    map.setTerrain(null);
  }

  if (!map.getLayer('sky')) {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 12
      }
    });
  }

  if (currentGeojsonRoute) {
    if (!map.getSource('route')) {
      map.addSource('route', {
        type: 'geojson',
        data: currentGeojsonRoute,
        lineMetrics: true
      });

      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.85
        }
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f24e1e',
          'line-width': 4.5,
          'line-opacity': 0.95
        }
      });
    } else {
      map.getSource('route').setData(currentGeojsonRoute);
    }
  }

  // Capa para resaltar el segmento seleccionado o en creación sobre el mapa
  if (!map.getSource('segment-highlight')) {
    map.addSource('segment-highlight', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
      id: 'segment-highlight-casing',
      type: 'line',
      source: 'segment-highlight',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#111318',
        'line-width': 10,
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: 'segment-highlight-line',
      type: 'line',
      source: 'segment-highlight',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 6,
        'line-opacity': 1
      }
    });
  }
}

// ================= REPRODUCTOR Y CÁMARA 3D =================
function updateCameraAndHUD() {
  if (!lineToFollow || routeDistanceKm <= 0) return;

  const currentPoint = turf.along(lineToFollow, currentDistanceKm, { units: 'kilometers' });
  const coords = currentPoint.geometry.coordinates;

  const lookAheadDist = Math.min(currentDistanceKm + 0.05, routeDistanceKm);
  const nextPoint = turf.along(lineToFollow, lookAheadDist, { units: 'kilometers' });
  const bearing = turf.bearing(currentPoint, nextPoint);

  if (map) {
    map.jumpTo({
      center: coords,
      bearing,
      pitch: is3DMode ? 70 : 0,
      zoom: is3DMode ? 15.5 : Math.max(map.getZoom(), 13.5)
    });
    athleteMarker.setLngLat(coords).addTo(map);
  }

  const ratio = currentDistanceKm / routeDistanceKm;
  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.value = ratio * 100;
  }

  const currentTimeEl = document.getElementById('timeline-current-time');
  if (currentTimeEl && currentActivity && currentActivity.movingTime) {
    currentTimeEl.innerText = formatClock(ratio * currentActivity.movingTime);
  }

  updateHUD(coords[2] || 0);
  drawElevationProfile(currentActivity ? currentActivity.elevationProfile : [], currentDistanceKm);
}

function updateHUD(currentAlt) {
  const hudSpeed = document.getElementById('hud-speed');
  const hudElevation = document.getElementById('hud-elevation');
  const hudGrade = document.getElementById('hud-grade');
  const hudDistance = document.getElementById('hud-distance');

  if (hudDistance) {
    hudDistance.innerHTML = `${currentDistanceKm.toFixed(2)} / ${routeDistanceKm.toFixed(2)} <small>km</small>`;
  }

  let elevationValue = currentAlt;
  if (currentActivity && currentActivity.elevationProfile && currentActivity.elevationProfile.length > 0) {
    const pt =
      currentActivity.elevationProfile.find((p) => p.distance >= currentDistanceKm) ||
      currentActivity.elevationProfile[currentActivity.elevationProfile.length - 1];
    if (pt) {
      if (!elevationValue && pt.elevation) elevationValue = pt.elevation;
      if (hudGrade) {
        hudGrade.innerHTML = `${pt.grade > 0 ? '+' : ''}${pt.grade.toFixed(1)} <small>%</small>`;
      }
    }
  }

  if (hudElevation) {
    hudElevation.innerHTML = `${Math.round(elevationValue)} <small>m</small>`;
  }

  if (hudSpeed && currentActivity) {
    hudSpeed.innerHTML = formatPaceOrSpeed(currentActivity.averageSpeed, currentActivity.type);
  }
}

function animate() {
  if (!isPlaying) return;

  currentDistanceKm += playbackSpeed * speedMultiplier;
  if (currentDistanceKm >= routeDistanceKm) {
    currentDistanceKm = routeDistanceKm;
    isPlaying = false;
    setPlayButtonState(false);
    updateCameraAndHUD();
    return;
  }

  updateCameraAndHUD();
  animationFrame = requestAnimationFrame(animate);
}

function togglePlayback() {
  if (!currentGeojsonRoute || routeDistanceKm <= 0) return;

  isPlaying = !isPlaying;
  setPlayButtonState(isPlaying);

  if (isPlaying) {
    if (currentDistanceKm >= routeDistanceKm) {
      currentDistanceKm = 0;
    }
    if (!is3DMode) {
      set3DMode(true);
    }
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animate();
  } else {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  }
}

// ================= GRÁFICO PERFIL DE ELEVACIÓN (HiDPI) =================
function drawElevationProfile(profileData, activeDistanceKm = null) {
  const canvas = document.getElementById('elevation-canvas');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 340;
  const cssHeight = canvas.clientHeight || 136;

  if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!profileData || profileData.length < 2) {
    ctx.fillStyle = '#8a92a0';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos de elevación', cssWidth / 2, cssHeight / 2);
    return;
  }

  const paddingLeft = 40;
  const paddingBottom = 22;
  const paddingTop = 12;
  const paddingRight = 10;

  const chartWidth = cssWidth - paddingLeft - paddingRight;
  const chartHeight = cssHeight - paddingTop - paddingBottom;

  const maxDist = profileData[profileData.length - 1].distance || 1;
  const minEle = Math.min(...profileData.map((p) => p.elevation));
  const maxEle = Math.max(...profileData.map((p) => p.elevation));
  const eleSpan = Math.max(10, maxEle - minEle);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(17, 19, 24, 0.06)';
  const labelColor = isDark ? '#6e7787' : '#8a92a0';
  const cursorColor = isDark ? 'rgba(243, 245, 248, 0.45)' : 'rgba(17, 19, 24, 0.35)';

  // Grid horizontal limpio
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(cssWidth - paddingRight, y);
    ctx.stroke();

    const eleVal = Math.round(maxEle - (eleSpan / 3) * i);
    ctx.fillStyle = labelColor;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${eleVal}m`, paddingLeft - 6, y + 3);
  }

  // Área rellena
  ctx.beginPath();
  profileData.forEach((pt, i) => {
    const x = paddingLeft + (pt.distance / maxDist) * chartWidth;
    const y = paddingTop + chartHeight - ((pt.elevation - minEle) / eleSpan) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const gradient = ctx.createLinearGradient(0, paddingTop, 0, cssHeight - paddingBottom);
  gradient.addColorStop(0, 'rgba(242, 78, 30, 0.22)');
  gradient.addColorStop(1, 'rgba(242, 78, 30, 0.01)');

  ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
  ctx.lineTo(paddingLeft, paddingTop + chartHeight);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Contorno
  ctx.beginPath();
  profileData.forEach((pt, i) => {
    const x = paddingLeft + (pt.distance / maxDist) * chartWidth;
    const y = paddingTop + chartHeight - ((pt.elevation - minEle) / eleSpan) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#f24e1e';
  ctx.lineWidth = 1.75;
  ctx.stroke();

  // Sombreado de segmento activo o en creación en la gráfica de altimetría
  if (activeHighlightedSegment && activeHighlightedSegment.startDistanceKm !== undefined) {
    const sX =
      paddingLeft + (Math.max(0, Math.min(activeHighlightedSegment.startDistanceKm, maxDist)) / maxDist) * chartWidth;
    const eX =
      paddingLeft + (Math.max(0, Math.min(activeHighlightedSegment.endDistanceKm, maxDist)) / maxDist) * chartWidth;
    if (eX > sX) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
      ctx.fillRect(sX, paddingTop, eX - sX, chartHeight);
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sX, paddingTop);
      ctx.lineTo(sX, paddingTop + chartHeight);
      ctx.moveTo(eX, paddingTop);
      ctx.lineTo(eX, paddingTop + chartHeight);
      ctx.stroke();
    }
  }

  // Cursor actual
  if (activeDistanceKm !== null && activeDistanceKm >= 0) {
    const curX = paddingLeft + (Math.min(activeDistanceKm, maxDist) / maxDist) * chartWidth;
    ctx.strokeStyle = cursorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(curX, paddingTop);
    ctx.lineTo(curX, paddingTop + chartHeight);
    ctx.stroke();

    const currentPoint =
      profileData.find((p) => p.distance >= activeDistanceKm) || profileData[profileData.length - 1];
    if (currentPoint) {
      const curY = paddingTop + chartHeight - ((currentPoint.elevation - minEle) / eleSpan) * chartHeight;
      ctx.fillStyle = '#f24e1e';
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Etiquetas eje X
  ctx.fillStyle = '#8a92a0';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('0 km', paddingLeft, cssHeight - 6);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxDist.toFixed(1)} km`, cssWidth - paddingRight, cssHeight - 6);
}

function setupElevationCanvasHover() {
  const canvas = document.getElementById('elevation-canvas');
  if (!canvas) return;

  canvas.addEventListener('mousemove', (e) => {
    if (!currentActivity || !currentActivity.elevationProfile || currentActivity.elevationProfile.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const paddingLeft = 40;
    const paddingRight = 10;
    const chartWidth = rect.width - paddingLeft - paddingRight;
    const ratio = Math.max(0, Math.min(1, (mouseX - paddingLeft) / chartWidth));

    const targetDist = ratio * routeDistanceKm;
    const pt =
      currentActivity.elevationProfile.find((p) => p.distance >= targetDist) ||
      currentActivity.elevationProfile[currentActivity.elevationProfile.length - 1];

    if (pt) {
      const hoverInfo = document.getElementById('profile-hover-info');
      if (hoverInfo) {
        hoverInfo.innerText = `${pt.distance.toFixed(2)} km · ${pt.elevation} m · ${pt.grade > 0 ? '+' : ''}${pt.grade}%`;
      }
      currentDistanceKm = pt.distance;
      updateCameraAndHUD();
    }
  });
}

// ================= CARGA DE ACTIVIDAD EN EL VISOR 3D =================
async function loadActivityIntoViewer(activityId) {
  try {
    const res = await apiFetch(`/api/activities/${activityId}`);
    const data = await res.json();
    if (!data.success || !data.activity) return;

    isPlaying = false;
    setPlayButtonState(false);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    currentActivity = data.activity;
    currentGeojsonRoute = currentActivity.geojson;

    const feature = currentGeojsonRoute.features.find(
      (f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
    );
    if (feature) {
      lineToFollow =
        feature.geometry.type === 'MultiLineString'
          ? { type: 'Feature', geometry: { type: 'LineString', coordinates: feature.geometry.coordinates[0] } }
          : feature;
      routeDistanceKm = turf.length(lineToFollow, { units: 'kilometers' });
      playbackSpeed = routeDistanceKm / 1600;
      currentDistanceKm = 0;
    }

    // Panel lateral
    const sportBadge = document.getElementById('detail-sport-badge');
    if (sportBadge) {
      sportBadge.innerText = getSportName(currentActivity.type);
    }
    document.getElementById('detail-title').innerText = currentActivity.title;
    document.getElementById('detail-date').innerText = formatDate(currentActivity.startDate);

    document.getElementById('detail-distance').innerHTML = `${formatDistance(currentActivity.distance)} <small>km</small>`;
    document.getElementById('detail-time').innerText = formatDuration(currentActivity.movingTime);
    document.getElementById('detail-elevation').innerHTML = `+${currentActivity.totalElevationGain || 0} <small>m</small>`;
    document.getElementById('detail-avg-speed').innerHTML = formatPaceOrSpeed(currentActivity.averageSpeed, currentActivity.type);
    document.getElementById('detail-max-speed').innerHTML = `${(currentActivity.maxSpeed || 0).toFixed(1)} <small>km/h</small>`;
    document.getElementById('detail-calories').innerHTML = `${currentActivity.calories || 0} <small>kcal</small>`;

    const hrCard = document.getElementById('detail-hr-card');
    if (currentActivity.averageHeartrate) {
      hrCard.style.display = 'flex';
      document.getElementById('detail-hr').innerHTML = `${currentActivity.averageHeartrate} / ${currentActivity.maxHeartrate || '--'} <small>bpm</small>`;
    } else {
      hrCard.style.display = 'none';
    }

    const powerCard = document.getElementById('detail-power-card');
    if (powerCard) {
      if (currentActivity.averageWatts || currentActivity.averageCadence) {
        powerCard.style.display = 'flex';
        const pParts = [
          currentActivity.averageWatts ? `${currentActivity.averageWatts} <small>W</small>` : null,
          currentActivity.averageCadence ? `${currentActivity.averageCadence} <small>rpm</small>` : null
        ].filter(Boolean);
        document.getElementById('detail-power').innerHTML = pParts.join(' · ');
      } else {
        powerCard.style.display = 'none';
      }
    }

    const gearCard = document.getElementById('detail-gear-card');
    if (currentActivity.gear) {
      gearCard.style.display = 'flex';
      document.getElementById('detail-gear').innerText = currentActivity.gear;
    } else {
      gearCard.style.display = 'none';
    }

    document.getElementById('detail-description').innerText = currentActivity.description || 'Sin notas adicionales.';

    // Timeline times & HUD inicial
    const timeline = document.getElementById('timeline');
    if (timeline) timeline.value = 0;
    const currentTimeEl = document.getElementById('timeline-current-time');
    const totalTimeEl = document.getElementById('timeline-total-time');
    if (currentTimeEl) currentTimeEl.innerText = '00:00';
    if (totalTimeEl) totalTimeEl.innerText = formatClock(currentActivity.movingTime);

    updateHUD(
      currentActivity.elevationProfile && currentActivity.elevationProfile[0]
        ? currentActivity.elevationProfile[0].elevation
        : 0
    );

    renderSplitsTable(currentActivity.splits || [], currentActivity.type, currentActivity.averageSpeed);
    closeSegmentCreatorPanel();
    loadSegmentsForCurrentActivity(currentActivity._id);

    // Marcadores de inicio y fin
    if (startMarker) startMarker.remove();
    if (finishMarker) finishMarker.remove();

    const coordsList =
      feature && feature.geometry.type === 'MultiLineString'
        ? feature.geometry.coordinates[0]
        : feature
          ? feature.geometry.coordinates
          : null;

    if (coordsList && coordsList.length >= 2 && map) {
      const startCoord = coordsList[0];
      const endCoord = coordsList[coordsList.length - 1];

      const startEl = document.createElement('div');
      startEl.className = 'route-pin start';
      startEl.innerText = 'Inicio';
      startMarker = new mapboxgl.Marker({ element: startEl }).setLngLat([startCoord[0], startCoord[1]]).addTo(map);

      const finishEl = document.createElement('div');
      finishEl.className = 'route-pin finish';
      finishEl.innerText = 'Fin';
      finishMarker = new mapboxgl.Marker({ element: finishEl }).setLngLat([endCoord[0], endCoord[1]]).addTo(map);
    }

    switchTab('viewer');

    // Esperar a que la pestaña sea visible para dimensionar bien canvas y mapa y hacer zoom exacto a la ruta
    const applyRouteAndZoom = () => {
      drawElevationProfile(currentActivity.elevationProfile || [], 0);
      if (!map) return;
      map.resize();
      set3DMode(false, { skipFit: true });
      if (map.isStyleLoaded()) {
        addCustomTerrainAndRoute();
        fitViewerMapToCurrentRoute({ duration: 850 });
      } else {
        map.once('load', () => {
          addCustomTerrainAndRoute();
          fitViewerMapToCurrentRoute({ duration: 850 });
        });
      }
    };

    requestAnimationFrame(() => {
      setTimeout(applyRouteAndZoom, 100);
    });
  } catch (err) {
    console.error('Error cargando actividad en visor:', err);
  }
}

function renderSplitsTable(splits, sportType, avgSpeed) {
  const tbody = document.getElementById('splits-table-body');
  if (!tbody) return;

  if (!splits || splits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-table-cell">Sin datos de parciales</td></tr>';
    return;
  }

  tbody.innerHTML = splits
    .map((s) => {
      const paceOrSpeed = formatPaceOrSpeed(s.averageSpeed, sportType);
      const timeFormatted = formatDuration(s.movingTime);
      const eleDiff = s.elevationDifference || 0;
      const eleClass = eleDiff > 0 ? 'text-accent' : '';
      const ratio = avgSpeed > 0 ? Math.min(100, Math.max(18, (s.averageSpeed / avgSpeed) * 55)) : 50;

      return `
        <tr>
          <td><strong>${s.split}</strong></td>
          <td>${paceOrSpeed}</td>
          <td>${timeFormatted}</td>
          <td class="${eleClass}">${eleDiff > 0 ? '+' : ''}${eleDiff}m</td>
          <td>
            <div class="pace-bar-wrapper">
              <div class="pace-bar-fill" style="width: ${ratio}%;"></div>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ================= SEGMENTOS EN RUTA Y MAPA (ESTILO STRAVA) =================
function classifySegmentCategoryClient(distanceMeters, avgGrade) {
  const score = (distanceMeters / 1000) * Math.max(0, avgGrade) * Math.max(0, avgGrade);
  if (avgGrade < 2.5 || distanceMeters < 300) return 'Llano / Sprint';
  if (score >= 600) return 'HC';
  if (score >= 300) return '1ª Cat';
  if (score >= 150) return '2ª Cat';
  if (score >= 70) return '3ª Cat';
  if (score >= 25) return '4ª Cat';
  return 'Repecho';
}

function clearSegmentHighlightFromMap() {
  activeHighlightedSegment = null;
  if (segStartMarker) {
    segStartMarker.remove();
    segStartMarker = null;
  }
  if (segEndMarker) {
    segEndMarker.remove();
    segEndMarker = null;
  }
  if (map && map.getSource('segment-highlight')) {
    map.getSource('segment-highlight').setData({ type: 'FeatureCollection', features: [] });
  }
  if (currentActivity) {
    drawElevationProfile(currentActivity.elevationProfile || [], currentDistanceKm);
  }
}

function highlightSegmentOnMap(seg, flyToSegment = true) {
  if (!map || !lineToFollow) return;

  activeHighlightedSegment = seg;
  let coords = seg.coordinates;

  if ((!coords || coords.length < 2) && seg.startDistanceKm !== undefined && seg.endDistanceKm !== undefined) {
    const sliced = turf.lineSliceAlong(lineToFollow, seg.startDistanceKm, seg.endDistanceKm, { units: 'kilometers' });
    coords = sliced.geometry.coordinates;
  }
  if (!coords || coords.length < 2) return;

  if (map.getSource('segment-highlight')) {
    map.getSource('segment-highlight').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords }
        }
      ]
    });
  }

  if (segStartMarker) segStartMarker.remove();
  if (segEndMarker) segEndMarker.remove();

  const startEl = document.createElement('div');
  startEl.className = 'route-pin seg-start';
  startEl.innerText = `Inicio ${seg.startDistanceKm.toFixed(2)} km`;
  segStartMarker = new mapboxgl.Marker({ element: startEl }).setLngLat([coords[0][0], coords[0][1]]).addTo(map);

  const endCoord = coords[coords.length - 1];
  const endEl = document.createElement('div');
  endEl.className = 'route-pin seg-end';
  endEl.innerText = `Meta ${seg.endDistanceKm.toFixed(2)} km`;
  segEndMarker = new mapboxgl.Marker({ element: endEl }).setLngLat([endCoord[0], endCoord[1]]).addTo(map);

  if (currentActivity) {
    drawElevationProfile(currentActivity.elevationProfile || [], currentDistanceKm);
  }

  if (flyToSegment) {
    const bbox = turf.bbox({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]]
      ],
      {
        padding: { top: 90, bottom: 160, left: 70, right: 70 },
        pitch: is3DMode ? 65 : 0,
        bearing: is3DMode ? 25 : 0,
        maxZoom: 15.5,
        duration: 900
      }
    );
  }
}

async function loadSegmentsForCurrentActivity(activityId) {
  const container = document.getElementById('segments-list-container');
  if (!container) return;

  try {
    const res = await apiFetch(`/api/segments?activityId=${activityId}`);
    const data = await res.json();
    if (!data.success) return;

    currentRouteSegments = data.segments || [];
    renderSegmentsList();
  } catch (err) {
    console.error('Error cargando segmentos:', err);
  }
}

function renderSegmentsList() {
  const container = document.getElementById('segments-list-container');
  if (!container) return;

  if (currentRouteSegments.length === 0) {
    container.innerHTML = `<p class="maint-empty">No hay segmentos creados en esta ruta. Pulsa «+ Crear segmento» para marcar un puerto o sprint en el mapa.</p>`;
    return;
  }

  container.innerHTML = currentRouteSegments
    .map((seg) => {
      const distKm = (seg.distanceMeters / 1000).toFixed(2);
      const isSelected = activeHighlightedSegment && String(activeHighlightedSegment._id) === String(seg._id);
      const efforts = seg.efforts || [];

      const leaderboardHtml =
        efforts.length > 0
          ? `
            <div class="segment-leaderboard">
              ${efforts
                .slice(0, 4)
                .map(
                  (ef, idx) => `
                  <div class="segment-lb-row">
                    <div class="segment-lb-user">
                      <span class="kom-rank-badge ${idx === 0 ? 'is-kom' : ''}">${idx === 0 ? 'KOM #1' : `#${idx + 1}`}</span>
                      <span>${ef.userName}${ef.bikeName ? ` · ${ef.bikeName}` : ''}</span>
                    </div>
                    <span class="segment-lb-time">${formatDuration(ef.elapsedTime)} (${ef.averageSpeed} km/h)</span>
                  </div>
                `
                )
                .join('')}
            </div>
          `
          : '';

      return `
        <div class="segment-item-card ${isSelected ? 'active' : ''}" data-seg-id="${seg._id}">
          <div class="segment-item-top">
            <div class="segment-item-title-wrap">
              <div class="segment-item-name">
                <span>${seg.name}</span>
                <span class="seg-cat-badge">${seg.category || 'Tramo'}</span>
              </div>
              <span class="segment-item-specs">
                Km ${seg.startDistanceKm.toFixed(1)} → ${seg.endDistanceKm.toFixed(1)} · ${distKm} km · ${seg.averageGrade > 0 ? '+' : ''}${seg.averageGrade}% · +${seg.elevationGain} m
              </span>
            </div>
            <button
              class="btn-icon-only danger delete-seg-btn"
              data-seg-id="${seg._id}"
              type="button"
              title="Eliminar segmento"
            >
              ${ICONS.trash}
            </button>
          </div>
          ${leaderboardHtml}
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.segment-item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-seg-btn')) return;
      const seg = currentRouteSegments.find((s) => String(s._id) === String(card.dataset.segId));
      if (!seg) return;

      if (activeHighlightedSegment && String(activeHighlightedSegment._id) === String(seg._id)) {
        clearSegmentHighlightFromMap();
        renderSegmentsList();
      } else {
        highlightSegmentOnMap(seg, true);
        renderSegmentsList();
      }
    });
  });

  container.querySelectorAll('.delete-seg-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este segmento de la ruta?')) return;
      try {
        const res = await apiFetch(`/api/segments/${btn.dataset.segId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success && currentActivity) {
          clearSegmentHighlightFromMap();
          await loadSegmentsForCurrentActivity(currentActivity._id);
        }
      } catch (err) {
        alert('Error eliminando segmento: ' + err.message);
      }
    });
  });
}

function openSegmentCreatorPanel() {
  if (!currentActivity || !lineToFollow || routeDistanceKm <= 0) {
    alert('Primero abre una ruta en el Visor 3D para crear un segmento.');
    return;
  }

  const panel = document.getElementById('segment-creator-panel');
  const startSlider = document.getElementById('seg-start-slider');
  const endSlider = document.getElementById('seg-end-slider');
  const nameInput = document.getElementById('seg-name-input');
  if (!panel || !startSlider || !endSlider) return;

  isSegmentCreatorOpen = true;
  segCreatorClickStage = 'start';

  const maxKm = Number(routeDistanceKm.toFixed(2));
  const defaultStart = Number((maxKm * 0.25).toFixed(2));
  const defaultEnd = Number(Math.min(maxKm, Math.max(defaultStart + 0.5, maxKm * 0.55)).toFixed(2));

  startSlider.max = maxKm;
  endSlider.max = maxKm;
  startSlider.value = defaultStart;
  endSlider.value = defaultEnd;
  if (nameInput) nameInput.value = '';

  panel.style.display = 'flex';
  updateSegmentCreatorPreview();
}

function closeSegmentCreatorPanel() {
  isSegmentCreatorOpen = false;
  const panel = document.getElementById('segment-creator-panel');
  if (panel) panel.style.display = 'none';
  clearSegmentHighlightFromMap();
}

function updateSegmentCreatorPreview() {
  if (!isSegmentCreatorOpen || !lineToFollow || !currentActivity) return;

  const startSlider = document.getElementById('seg-start-slider');
  const endSlider = document.getElementById('seg-end-slider');
  if (!startSlider || !endSlider) return;

  let startKm = parseFloat(startSlider.value) || 0;
  let endKm = parseFloat(endSlider.value) || 0;

  if (endKm <= startKm + 0.1) {
    endKm = Math.min(routeDistanceKm, startKm + 0.15);
    endSlider.value = endKm;
  }

  document.getElementById('seg-start-km-label').innerText = `${startKm.toFixed(2)} km`;
  document.getElementById('seg-end-km-label').innerText = `${endKm.toFixed(2)} km`;

  const distKm = endKm - startKm;
  const distMeters = Math.round(distKm * 1000);

  const profile = currentActivity.elevationProfile || [];
  const getEleAtDist = (km) => {
    if (profile.length === 0) return 0;
    const pt = profile.find((p) => p.distance >= km) || profile[profile.length - 1];
    return pt ? pt.elevation : 0;
  };

  const startEle = getEleAtDist(startKm);
  const endEle = getEleAtDist(endKm);
  let eleGain = 0;
  const subProfile = profile.filter((p) => p.distance >= startKm && p.distance <= endKm);
  if (subProfile.length >= 2) {
    for (let i = 1; i < subProfile.length; i++) {
      const diff = subProfile[i].elevation - subProfile[i - 1].elevation;
      if (diff > 0) eleGain += diff;
    }
  } else {
    eleGain = Math.max(0, endEle - startEle);
  }

  const avgGrade = distMeters > 0 ? Number((((endEle - startEle) / distMeters) * 100).toFixed(1)) : 0;
  const cat = classifySegmentCategoryClient(distMeters, avgGrade);

  document.getElementById('seg-preview-dist').innerText = `${distKm.toFixed(2)} km`;
  document.getElementById('seg-preview-ele').innerText = `+${Math.round(eleGain)} m`;
  document.getElementById('seg-preview-grade').innerText = `${avgGrade > 0 ? '+' : ''}${avgGrade}%`;
  document.getElementById('seg-preview-cat').innerText = cat;

  highlightSegmentOnMap(
    {
      _id: '__preview__',
      startDistanceKm: startKm,
      endDistanceKm: endKm
    },
    false
  );
}

function setupSegmentCreator() {
  const toggleBtn = document.getElementById('toggle-segment-creator-btn');
  const drawerBtn = document.getElementById('drawer-create-segment-btn');
  const closeBtn = document.getElementById('close-segment-creator-btn');
  const cancelBtn = document.getElementById('cancel-segment-creator-btn');
  const startSlider = document.getElementById('seg-start-slider');
  const endSlider = document.getElementById('seg-end-slider');
  const form = document.getElementById('create-segment-form');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isSegmentCreatorOpen) closeSegmentCreatorPanel();
      else openSegmentCreatorPanel();
    });
  }

  if (drawerBtn) {
    drawerBtn.addEventListener('click', () => {
      openSegmentCreatorPanel();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeSegmentCreatorPanel);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSegmentCreatorPanel);

  if (startSlider) {
    startSlider.addEventListener('input', () => {
      if (parseFloat(startSlider.value) >= parseFloat(endSlider.value) - 0.1) {
        endSlider.value = Math.min(routeDistanceKm, parseFloat(startSlider.value) + 0.15);
      }
      updateSegmentCreatorPreview();
    });
  }

  if (endSlider) {
    endSlider.addEventListener('input', () => {
      if (parseFloat(endSlider.value) <= parseFloat(startSlider.value) + 0.1) {
        startSlider.value = Math.max(0, parseFloat(endSlider.value) - 0.15);
      }
      updateSegmentCreatorPreview();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentActivity) return;

      const name = document.getElementById('seg-name-input').value;
      const startDistanceKm = parseFloat(startSlider.value);
      const endDistanceKm = parseFloat(endSlider.value);
      const saveBtn = document.getElementById('save-segment-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Guardando…';
      }

      try {
        const res = await apiFetch('/api/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            activityId: currentActivity._id,
            startDistanceKm,
            endDistanceKm
          })
        });
        const data = await res.json();
        if (data.success && data.segment) {
          closeSegmentCreatorPanel();
          await loadSegmentsForCurrentActivity(currentActivity._id);
          highlightSegmentOnMap(data.segment, true);
          renderSegmentsList();
        } else {
          alert(data.error || 'No se pudo crear el segmento');
        }
      } catch (err) {
        alert('Error creando segmento: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Guardar segmento';
        }
      }
    });
  }
}

// ================= ZONA DE SEGMENTOS (MAPA POR DEFECTO Y DIBUJO LIBRE) =================
function initSegmentsZoneMap() {
  const container = document.getElementById('segments-map');
  if (!container || !MAPBOX_TOKEN) return;

  if (segmentsMap) {
    segmentsMap.resize();
    return;
  }

  segmentsMap = new mapboxgl.Map({
    container: 'segments-map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-3.2681, 40.5658], // Azuqueca de Henares, Guadalajara
    zoom: 13,
    pitch: 0,
    bearing: 0
  });

  segmentsMap.getCanvas().style.cursor = 'crosshair';

  segmentsMap.on('load', () => {
    segmentsMap.resize();
  });

  segmentsMap.on('style.load', () => {
    setupSegmentsZoneLayers();
    renderSavedSegmentsOnZoneMap();
    updateDrawnSegmentOnMap();
  });

  // Al hacer clic en el mapa de la Zona Segmentos, añade un punto y traza siguiendo la carretera/camino o saliendo fuera de calzada si se clica fuera
  segmentsMap.on('click', async (e) => {
    const clickedCoord = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
    const isNearRenderedWay = checkIfClickIsNearRoadOrTrail(e.point);
    await addSegmentWaypoint(clickedCoord, isNearRenderedWay);
  });

  requestAnimationFrame(() => {
    if (segmentsMap) segmentsMap.resize();
  });
}

/**
 * Comprueba en los vector tiles renderizados del mapa si el clic (en píxeles) se ha hecho sobre
 * una carretera, pista, camino o sendero dibujado en el mapa (tolerancia de 10px).
 * Si el usuario hace clic fuera de cualquier camino (campo a través), devuelve false para permitir salir de la calzada.
 */
function checkIfClickIsNearRoadOrTrail(pointPx, targetMap = segmentsMap) {
  if (!targetMap || !pointPx) return true;
  try {
    const bbox = [
      [pointPx.x - 10, pointPx.y - 10],
      [pointPx.x + 10, pointPx.y + 10]
    ];
    const features = targetMap.queryRenderedFeatures(bbox);
    return features.some((f) => {
      const sl = f.sourceLayer || f.layer?.['source-layer'] || '';
      const lid = (f.layer?.id || '').toLowerCase();
      return (
        sl === 'road' ||
        lid.includes('road') ||
        lid.includes('path') ||
        lid.includes('track') ||
        lid.includes('trail') ||
        lid.includes('bridge') ||
        lid.includes('tunnel')
      );
    });
  } catch {
    return true;
  }
}

/**
 * Obtiene la trazada real por carretera, pista o sendero entre dos coordenadas.
 * - Si el usuario clica fuera de una calzada/sendero (!endIsOnWay), o venía de fuera (!startIsOnWay),
 *   o si seguir la calzada obligaría a dar un rodeo (>1.55x, como ir a una rotonda y volver),
 *   permite salirse de la calzada directamente al punto exacto donde ha hecho clic.
 */
async function fetchSnappedPathBetweenPoints(
  startCoord,
  endCoord,
  startIsOnWay = true,
  endIsOnWay = true,
  snapEnabled = isSnapToTrailEnabled
) {
  if (!snapEnabled || !MAPBOX_TOKEN || !startIsOnWay || !endIsOnWay) {
    return {
      snappedStart: startCoord,
      snappedEnd: endCoord,
      coords: [startCoord, endCoord]
    };
  }

  const pair = `${startCoord[0]},${startCoord[1]};${endCoord[0]},${endCoord[1]}`;
  const directDistMeters = turf.distance(turf.point(startCoord), turf.point(endCoord), { units: 'meters' });

  if (directDistMeters < 15) {
    return {
      snappedStart: startCoord,
      snappedEnd: endCoord,
      coords: [startCoord, endCoord]
    };
  }

  try {
    const [cyclingRes, walkingRes] = await Promise.all([
      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${pair}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      )
        .then((r) => r.json())
        .catch(() => null),
      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${pair}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      )
        .then((r) => r.json())
        .catch(() => null)
    ]);

    const candidates = [];
    if (cyclingRes?.routes?.[0]) {
      candidates.push({
        route: cyclingRes.routes[0]
      });
    }
    if (walkingRes?.routes?.[0]) {
      candidates.push({
        route: walkingRes.routes[0]
      });
    }

    // Filtrar candidatos que:
    // 1) No desplacen el punto clicado a otra calle lejana (máx 24 metros de imán al centro de la vía)
    // 2) No hagan un rodeo por rotondas o calles adyacentes (máx 1.55x la distancia en línea recta entre los dos clics)
    const validCandidates = candidates.filter((c) => {
      const coords = c.route?.geometry?.coordinates;
      if (!coords || coords.length < 2) return false;

      const snappedEnd = coords[coords.length - 1];
      const snapOffsetMeters = turf.distance(turf.point(endCoord), turf.point(snappedEnd), { units: 'meters' });
      if (snapOffsetMeters > 24) return false;

      const routeDistMeters = c.route.distance || turf.length(turf.lineString(coords), { units: 'meters' });
      const maxAllowedMeters = Math.max(directDistMeters * 1.55, directDistMeters + 35);
      return routeDistMeters <= maxAllowedMeters;
    });

    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => (a.route.distance || 0) - (b.route.distance || 0));
      const best = validCandidates[0].route.geometry.coordinates;
      return {
        snappedStart: best[0],
        snappedEnd: best[best.length - 1],
        coords: best
      };
    }
  } catch (err) {
    console.warn('Fallback a línea directa:', err);
  }

  return {
    snappedStart: startCoord,
    snappedEnd: endCoord,
    coords: [startCoord, endCoord]
  };
}

function rebuildDrawnSegmentCoords() {
  if (drawnWaypoints.length === 0) {
    drawnSegmentCoords = [];
    return;
  }
  if (drawnWaypoints.length === 1) {
    drawnSegmentCoords = [drawnWaypoints[0]];
    return;
  }

  const combined = [];
  drawnLegs.forEach((leg, idx) => {
    if (idx === 0) {
      combined.push(...leg);
    } else {
      combined.push(...leg.slice(1));
    }
  });

  // Añadir elevación 3D desde el DEM de Mapbox si está disponible
  drawnSegmentCoords = combined.map((c) => {
    let ele = c[2] || 0;
    if (!ele && segmentsMap && typeof segmentsMap.queryTerrainElevation === 'function') {
      const sampled = segmentsMap.queryTerrainElevation([c[0], c[1]]);
      if (sampled !== null && sampled !== undefined && !Number.isNaN(sampled)) {
        ele = Math.round(sampled);
      }
    }
    return [c[0], c[1], ele];
  });
}

async function addSegmentWaypoint(coord, isNearRenderedWay = true) {
  const hintTextEl = document.getElementById('seg-draw-status-text');

  if (drawnWaypoints.length === 0) {
    drawnWaypoints.push(coord);
    drawnWaypointsOnWay.push(isNearRenderedWay);
    rebuildDrawnSegmentCoords();
    updateDrawnSegmentOnMap();
    return;
  }

  const prevWaypoint = drawnWaypoints[drawnWaypoints.length - 1];
  const prevWasOnWay = drawnWaypointsOnWay[drawnWaypointsOnWay.length - 1] ?? true;

  if (hintTextEl) {
    hintTextEl.innerText = isNearRenderedWay ? 'Ajustando al camino…' : 'Trazando fuera de calzada…';
  }

  const { snappedStart, snappedEnd, coords } = await fetchSnappedPathBetweenPoints(
    prevWaypoint,
    coord,
    prevWasOnWay,
    isNearRenderedWay
  );

  if (drawnWaypoints.length === 1 && isSnapToTrailEnabled && prevWasOnWay && isNearRenderedWay) {
    drawnWaypoints[0] = snappedStart;
  }
  drawnWaypoints.push(isSnapToTrailEnabled && isNearRenderedWay ? snappedEnd : coord);
  drawnWaypointsOnWay.push(isNearRenderedWay);
  drawnLegs.push(coords);

  rebuildDrawnSegmentCoords();
  updateDrawnSegmentOnMap();
}

function setupSegmentsZoneLayers() {
  if (!segmentsMap) return;

  if (!segmentsMap.getSource('mapbox-dem')) {
    segmentsMap.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }

  // Mantener mapbox-dem activo siempre (con exaggeration: 0.0001 en 2D para que queryTerrainElevation lea el DEM real en cualquier zoom)
  if (isSegmentsMap3D) {
    segmentsMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  } else {
    segmentsMap.setTerrain({ source: 'mapbox-dem', exaggeration: 0.0001 });
  }

  // Capa con todos los segmentos ya guardados
  if (!segmentsMap.getSource('saved-segments-source')) {
    segmentsMap.addSource('saved-segments-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    segmentsMap.addLayer({
      id: 'saved-segments-casing',
      type: 'line',
      source: 'saved-segments-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': 7,
        'line-opacity': 0.85
      }
    });

    segmentsMap.addLayer({
      id: 'saved-segments-line',
      type: 'line',
      source: 'saved-segments-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0284c7',
        'line-width': 4,
        'line-opacity': 0.9
      }
    });
  }

  // Capa con el segmento que el usuario está dibujando actualmente
  if (!segmentsMap.getSource('drawn-segment-source')) {
    segmentsMap.addSource('drawn-segment-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    segmentsMap.addLayer({
      id: 'drawn-segment-casing',
      type: 'line',
      source: 'drawn-segment-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#111318',
        'line-width': 8,
        'line-opacity': 0.9
      }
    });

    segmentsMap.addLayer({
      id: 'drawn-segment-line',
      type: 'line',
      source: 'drawn-segment-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#f24e1e',
        'line-width': 4.5,
        'line-opacity': 1
      }
    });
  }
}

function renderSavedSegmentsOnZoneMap() {
  if (!segmentsMap || !segmentsMap.getSource('saved-segments-source')) return;

  const features = allSavedSegments
    .filter((s) => Array.isArray(s.coordinates) && s.coordinates.length >= 2)
    .map((s) => ({
      type: 'Feature',
      properties: { id: String(s._id), name: s.name },
      geometry: {
        type: 'LineString',
        coordinates: s.coordinates
      }
    }));

  segmentsMap.getSource('saved-segments-source').setData({
    type: 'FeatureCollection',
    features
  });
}

function updateDrawnSegmentOnMap() {
  // Actualizar marcadores de los puntos de paso (waypoints) clicados por el usuario
  drawnVertexMarkers.forEach((m) => m.remove());
  drawnVertexMarkers = [];

  if (segmentsMap) {
    drawnWaypoints.forEach((coord, index) => {
      const el = document.createElement('div');
      el.className = `seg-draw-vertex ${index === 0 ? 'first' : ''}`;
      el.title = index === 0 ? 'Inicio del segmento' : `Punto de control ${index + 1}`;
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([coord[0], coord[1]]).addTo(segmentsMap);
      drawnVertexMarkers.push(marker);
    });

    if (segmentsMap.getSource('drawn-segment-source')) {
      const features =
        drawnSegmentCoords.length >= 2
          ? [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: drawnSegmentCoords
                }
              }
            ]
          : [];
      segmentsMap.getSource('drawn-segment-source').setData({
        type: 'FeatureCollection',
        features
      });
    }
  }

  // Actualizar métricas del panel lateral
  const countEl = document.getElementById('drawn-seg-points-count');
  const distEl = document.getElementById('drawn-seg-distance');
  const stateEl = document.getElementById('drawn-seg-state');
  const hintTextEl = document.getElementById('seg-draw-status-text');

  const n = drawnWaypoints.length;
  if (countEl) countEl.innerText = `${n} ${n === 1 ? 'punto' : 'puntos'}`;

  let distKm = 0;
  if (drawnSegmentCoords.length >= 2) {
    const line = turf.lineString(drawnSegmentCoords.map((c) => [c[0], c[1]]));
    distKm = turf.length(line, { units: 'kilometers' });
  }

  if (distEl) {
    distEl.innerText = distKm >= 1 ? `${distKm.toFixed(2)} km` : `${Math.round(distKm * 1000)} m`;
  }

  if (stateEl) {
    if (n === 0) stateEl.innerText = 'Haz clic en el mapa';
    else if (n === 1) stateEl.innerText = 'Marca el siguiente punto';
    else stateEl.innerText = 'Ajustado al camino';
  }

  if (hintTextEl) {
    if (n === 0) {
      hintTextEl.innerText = 'Haz clic sobre una carretera o sendero para marcar el inicio';
    } else if (n === 1) {
      hintTextEl.innerText = 'Inicio fijado · haz clic más adelante en el camino para trazar';
    } else {
      hintTextEl.innerText = `Trazada ajustada al camino (${distKm.toFixed(2)} km) · sigue haciendo clic o guárdalo`;
    }
  }
}

function clearDrawnSegment() {
  drawnWaypoints = [];
  drawnWaypointsOnWay = [];
  drawnLegs = [];
  drawnSegmentCoords = [];
  updateDrawnSegmentOnMap();
}

async function loadAllSegmentsForZone() {
  const container = document.getElementById('all-segments-list');
  const countEl = document.getElementById('all-segments-count');

  try {
    const res = await apiFetch('/api/segments');
    const data = await res.json();
    if (!data.success) return;

    allSavedSegments = data.segments || [];
    if (countEl) {
      countEl.innerText = `${allSavedSegments.length} ${allSavedSegments.length === 1 ? 'segmento' : 'segmentos'}`;
    }

    renderSavedSegmentsOnZoneMap();
    renderAllSegmentsInZone();
  } catch (err) {
    console.error('Error cargando todos los segmentos:', err);
    if (container) {
      container.innerHTML = `<p class="maint-empty">Error cargando segmentos.</p>`;
    }
  }
}

function renderAllSegmentsInZone() {
  const container = document.getElementById('all-segments-list');
  if (!container) return;

  if (allSavedSegments.length === 0) {
    container.innerHTML = `<p class="maint-empty">Aún no hay segmentos. Haz clic en el mapa para dibujar el primero.</p>`;
    return;
  }

  container.innerHTML = allSavedSegments
    .map((seg) => {
      const distText =
        seg.distanceMeters >= 1000
          ? `${(seg.distanceMeters / 1000).toFixed(2)} km`
          : `${seg.distanceMeters} m`;
      const isSelected = String(selectedZoneSegmentId) === String(seg._id);
      const efforts = [...(seg.efforts || [])].sort((a, b) => a.elapsedTime - b.elapsedTime);

      const leaderboardHtml =
        efforts.length > 0
          ? `
            <div class="segment-leaderboard">
              ${efforts
                .slice(0, 3)
                .map(
                  (ef, idx) => `
                  <div class="segment-lb-row">
                    <div class="segment-lb-user">
                      <span class="kom-rank-badge ${idx === 0 ? 'is-kom' : ''}">${idx === 0 ? 'KOM #1' : `#${idx + 1}`}</span>
                      <span>${ef.userName}${ef.bikeName ? ` · ${ef.bikeName}` : ''}</span>
                    </div>
                    <span class="segment-lb-time">${formatDuration(ef.elapsedTime)} (${ef.averageSpeed} km/h)</span>
                  </div>
                `
                )
                .join('')}
            </div>
          `
          : `<span style="font-size: 11px; color: var(--text-muted);">Sin tiempos registrados aún en este tramo</span>`;

      return `
        <div class="segment-item-card ${isSelected ? 'active' : ''}" data-zone-seg-id="${seg._id}">
          <div class="segment-item-top">
            <div class="segment-item-title-wrap">
              <div class="segment-item-name">
                <span>${seg.name}</span>
                <span class="seg-cat-badge">${getSportName(seg.sportType)}</span>
              </div>
              <span class="segment-item-specs">
                ${distText}${seg.elevationGain ? ` · +${seg.elevationGain} m` : ''}${seg.averageGrade ? ` · ${seg.averageGrade}%` : ''}
              </span>
            </div>
            <button
              class="btn-icon-only danger delete-zone-seg-btn"
              data-seg-id="${seg._id}"
              type="button"
              title="Eliminar segmento"
            >
              ${ICONS.trash}
            </button>
          </div>
          ${leaderboardHtml}
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.segment-item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-zone-seg-btn')) return;
      const seg = allSavedSegments.find((s) => String(s._id) === String(card.dataset.zoneSegId));
      if (!seg || !segmentsMap || !Array.isArray(seg.coordinates) || seg.coordinates.length < 2) return;

      selectedZoneSegmentId = seg._id;
      renderAllSegmentsInZone();

      const bbox = turf.bbox({ type: 'Feature', geometry: { type: 'LineString', coordinates: seg.coordinates } });
      segmentsMap.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]]
        ],
        {
          padding: 90,
          pitch: isSegmentsMap3D ? 65 : 0,
          maxZoom: 15.5,
          duration: 900
        }
      );
    });
  });

  container.querySelectorAll('.delete-zone-seg-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este segmento?')) return;
      try {
        const res = await apiFetch(`/api/segments/${btn.dataset.segId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          await loadAllSegmentsForZone();
        }
      } catch (err) {
        alert('Error eliminando segmento: ' + err.message);
      }
    });
  });
}

function setupSegmentsZone() {
  const snapToggleBtn = document.getElementById('seg-snap-toggle-btn');
  const snapToggleText = document.getElementById('seg-snap-toggle-text');
  const undoBtn = document.getElementById('seg-undo-pt-btn');
  const clearBtn = document.getElementById('seg-clear-pts-btn');
  const resetBtn = document.getElementById('drawn-seg-reset-btn');
  const toggle3DBtn = document.getElementById('seg-toggle-3d-btn');
  const toggle3DText = document.getElementById('seg-toggle-3d-text');
  const styleSelector = document.getElementById('seg-style-selector');
  const form = document.getElementById('draw-segment-form');

  if (snapToggleBtn) {
    snapToggleBtn.addEventListener('click', () => {
      isSnapToTrailEnabled = !isSnapToTrailEnabled;
      snapToggleBtn.classList.toggle('active', isSnapToTrailEnabled);
      if (snapToggleText) {
        snapToggleText.innerText = `Seguir camino: ${isSnapToTrailEnabled ? 'Sí' : 'No'}`;
      }
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (drawnWaypoints.length > 0) {
        drawnWaypoints.pop();
        drawnWaypointsOnWay.pop();
        if (drawnLegs.length > 0) {
          drawnLegs.pop();
        }
        rebuildDrawnSegmentCoords();
        updateDrawnSegmentOnMap();
      }
    });
  }

  if (clearBtn) clearBtn.addEventListener('click', clearDrawnSegment);
  if (resetBtn) resetBtn.addEventListener('click', clearDrawnSegment);

  if (toggle3DBtn) {
    toggle3DBtn.addEventListener('click', () => {
      isSegmentsMap3D = !isSegmentsMap3D;
      toggle3DBtn.classList.toggle('active', isSegmentsMap3D);
      if (toggle3DText) toggle3DText.innerText = isSegmentsMap3D ? 'Vista 2D' : 'Vista 3D';
      if (segmentsMap) {
        if (isSegmentsMap3D) {
          segmentsMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          segmentsMap.easeTo({ pitch: 65, bearing: 25, duration: 900 });
        } else {
          segmentsMap.setTerrain({ source: 'mapbox-dem', exaggeration: 0.0001 });
          segmentsMap.easeTo({ pitch: 0, bearing: 0, duration: 900 });
        }
      }
    });
  }

  if (styleSelector) {
    styleSelector.addEventListener('change', (e) => {
      if (segmentsMap) segmentsMap.setStyle(e.target.value);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (drawnSegmentCoords.length < 2) {
        alert('Haz clic en al menos 2 puntos del mapa para trazar el segmento.');
        return;
      }

      const nameInput = document.getElementById('drawn-seg-name');
      const sportSelect = document.getElementById('drawn-seg-sport');
      const saveBtn = document.getElementById('drawn-seg-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Guardando…';
      }

      try {
        const res = await apiFetch('/api/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value,
            sportType: sportSelect.value,
            coordinates: drawnSegmentCoords
          })
        });
        const data = await res.json();
        if (data.success && data.segment) {
          nameInput.value = '';
          clearDrawnSegment();
          selectedZoneSegmentId = data.segment._id;
          await loadAllSegmentsForZone();
        } else {
          alert(data.error || 'Error al guardar el segmento');
        }
      } catch (err) {
        alert('Error guardando segmento: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Guardar segmento';
        }
      }
    });
  }
}

// ================= PLANIFICADOR DE RUTAS EN EL MAPA =================
function initPlannerMap() {
  const container = document.getElementById('planner-map');
  if (!container || !MAPBOX_TOKEN) return;

  if (plannerMap) {
    plannerMap.resize();
    return;
  }

  plannerMap = new mapboxgl.Map({
    container: 'planner-map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-3.2681, 40.5658], // Azuqueca de Henares, Guadalajara
    zoom: 13,
    pitch: 0,
    bearing: 0
  });

  plannerMap.getCanvas().style.cursor = 'crosshair';

  plannerMap.on('load', () => {
    plannerMap.resize();
  });

  plannerMap.on('style.load', () => {
    setupPlannerLayers();
    updatePlannerMapDisplay();
  });

  plannerMap.on('click', async (e) => {
    const clickedCoord = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
    if (isAddingWaterSourceMode) {
      await handleAddWaterSourceAtCoord(clickedCoord);
      return;
    }
    const isNearWay = checkIfClickIsNearRoadOrTrail(e.point, plannerMap);
    await addPlannerWaypoint(clickedCoord, isNearWay);
  });

  requestAnimationFrame(() => {
    if (plannerMap) plannerMap.resize();
  });
}

function setupPlannerLayers() {
  if (!plannerMap) return;

  if (!plannerMap.getSource('mapbox-dem')) {
    plannerMap.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }

  // Mantener mapbox-dem activo siempre (con exaggeration: 0.0001 en 2D para que queryTerrainElevation lea altitudes reales del DEM)
  if (isPlanner3D) {
    plannerMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  } else {
    plannerMap.setTerrain({ source: 'mapbox-dem', exaggeration: 0.0001 });
  }

  if (!plannerMap.getSource('planner-route-source')) {
    plannerMap.addSource('planner-route-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    plannerMap.addLayer({
      id: 'planner-route-casing',
      type: 'line',
      source: 'planner-route-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': 8,
        'line-opacity': 0.9
      }
    });

    plannerMap.addLayer({
      id: 'planner-route-line',
      type: 'line',
      source: 'planner-route-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#f24e1e',
        'line-width': 4.5,
        'line-opacity': 0.98
      }
    });
  }

  // Capa para colorear los tramos de la ruta según el viento (A favor = verde, Lateral = ámbar, En contra = rojo)
  if (!plannerMap.getSource('planner-wind-segments-source')) {
    plannerMap.addSource('planner-wind-segments-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    plannerMap.addLayer({
      id: 'planner-wind-segments-line',
      type: 'line',
      source: 'planner-wind-segments-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 6,
        'line-opacity': 0.95
      }
    });
  }

  // Capa de Mapa de Calor Ciclista (trazas reales de otros ciclistas en la zona)
  if (!plannerMap.getSource('planner-heatmap-source')) {
    plannerMap.addSource('planner-heatmap-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    plannerMap.addLayer(
      {
        id: 'planner-heatmap-glow',
        type: 'line',
        source: 'planner-heatmap-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f97316',
          'line-width': 10,
          'line-opacity': 0.25,
          'line-blur': 5
        }
      },
      'planner-route-casing'
    );

    plannerMap.addLayer(
      {
        id: 'planner-heatmap-core',
        type: 'line',
        source: 'planner-heatmap-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#fb923c',
          'line-width': 2.8,
          'line-opacity': 0.8
        }
      },
      'planner-route-casing'
    );
  }
}

async function addPlannerWaypoint(coord, isNearWay = true) {
  const statusEl = document.getElementById('planner-status-text');

  if (plannerWaypoints.length === 0) {
    plannerWaypoints.push(coord);
    plannerWaypointsOnWay.push(isNearWay);
    rebuildPlannerRouteAndElevation();
    updatePlannerMapDisplay();
    return;
  }

  const prevWaypoint = plannerWaypoints[plannerWaypoints.length - 1];
  const prevWasOnWay = plannerWaypointsOnWay[plannerWaypointsOnWay.length - 1] ?? true;

  if (statusEl) {
    statusEl.innerText = isNearWay ? 'Trazando por carretera / sendero…' : 'Trazando tramo libre…';
  }

  const { snappedStart, snappedEnd, coords } = await fetchSnappedPathBetweenPoints(
    prevWaypoint,
    coord,
    prevWasOnWay,
    isNearWay,
    isPlannerSnapEnabled
  );

  if (plannerWaypoints.length === 1 && isPlannerSnapEnabled && prevWasOnWay && isNearWay) {
    plannerWaypoints[0] = snappedStart;
  }
  plannerWaypoints.push(isPlannerSnapEnabled && isNearWay ? snappedEnd : coord);
  plannerWaypointsOnWay.push(isNearWay);
  plannerLegs.push(coords);

  rebuildPlannerRouteAndElevation();
  updatePlannerMapDisplay();
  refreshPlannerElevationsFromDemAPI();
}

function samplePlannerElevation(lng, lat) {
  if (plannerMap && typeof plannerMap.queryTerrainElevation === 'function') {
    const dem = plannerMap.queryTerrainElevation([lng, lat], { exaggerated: false });
    if (dem !== null && dem !== undefined && !Number.isNaN(dem)) {
      return Number(dem.toFixed(2));
    }
  }
  // Estimación topográfica suave sin redondeo prematuro si el tile DEM aún se está descargando
  const base = 680 + Math.sin(lng * 35) * 140 + Math.cos(lat * 35) * 120;
  return Number(base.toFixed(2));
}

function rebuildPlannerRouteAndElevation() {
  if (plannerWaypoints.length === 0) {
    plannerCoords = [];
    plannerElevationProfile = [];
    return;
  }

  if (plannerWaypoints.length === 1) {
    const c = plannerWaypoints[0];
    const ele = samplePlannerElevation(c[0], c[1]);
    plannerCoords = [[c[0], c[1], ele]];
    plannerElevationProfile = [{ distance: 0, elevation: Math.round(ele), rawElevation: ele, grade: 0 }];
    return;
  }

  const rawCombined = [];
  plannerLegs.forEach((leg, idx) => {
    if (idx === 0) rawCombined.push(...leg);
    else rawCombined.push(...leg.slice(1));
  });

  // Subdividir tramos largos para tener un perfil de elevación continuo y suave
  const densified = [rawCombined[0]];
  for (let i = 1; i < rawCombined.length; i++) {
    const prev = rawCombined[i - 1];
    const curr = rawCombined[i];
    const segDistKm = turf.distance(turf.point([prev[0], prev[1]]), turf.point([curr[0], curr[1]]), {
      units: 'kilometers'
    });
    if (segDistKm > 0.12) {
      const steps = Math.min(25, Math.ceil(segDistKm / 0.08));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const interpEle =
          prev[2] !== undefined && curr[2] !== undefined
            ? Number((prev[2] + (curr[2] - prev[2]) * t).toFixed(2))
            : undefined;
        densified.push(
          interpEle !== undefined
            ? [
                Number((prev[0] + (curr[0] - prev[0]) * t).toFixed(6)),
                Number((prev[1] + (curr[1] - prev[1]) * t).toFixed(6)),
                interpEle
              ]
            : [
                Number((prev[0] + (curr[0] - prev[0]) * t).toFixed(6)),
                Number((prev[1] + (curr[1] - prev[1]) * t).toFixed(6))
              ]
        );
      }
    }
    densified.push(curr);
  }

  const profile = [];
  plannerCoords = densified.map((c) => {
    const ele =
      c[2] !== undefined && c[2] !== 0 && !Number.isNaN(Number(c[2]))
        ? Number(Number(c[2]).toFixed(2))
        : samplePlannerElevation(c[0], c[1]);
    return [c[0], c[1], ele];
  });

  let runningKm = 0;
  for (let i = 0; i < plannerCoords.length; i++) {
    const curr = plannerCoords[i];
    let grade = 0;
    if (i > 0) {
      const prev = plannerCoords[i - 1];
      const dMeters = turf.distance(turf.point([prev[0], prev[1]]), turf.point([curr[0], curr[1]]), {
        units: 'meters'
      });
      runningKm += dMeters / 1000;
      // Calcular pendiente sobre una ventana de al menos ~35m para que no salga 0% por micro-segmentos
      let lookBackIdx = i - 1;
      let winMeters = dMeters;
      while (lookBackIdx > 0 && winMeters < 35) {
        lookBackIdx--;
        winMeters = turf.distance(
          turf.point([plannerCoords[lookBackIdx][0], plannerCoords[lookBackIdx][1]]),
          turf.point([curr[0], curr[1]]),
          { units: 'meters' }
        );
      }
      if (winMeters > 3) {
        const dEle = curr[2] - plannerCoords[lookBackIdx][2];
        grade = Number(Math.max(-28, Math.min(28, (dEle / winMeters) * 100)).toFixed(1));
      }
    }
    profile.push({
      distance: Number(runningKm.toFixed(3)),
      elevation: Math.round(curr[2]),
      rawElevation: curr[2],
      grade
    });
  }

  plannerElevationProfile = profile;
}

/**
 * Consulta Open-Meteo Elevation API (SRTM/Copernicus DEM 30m) para los puntos de la ruta
 * cuando el DEM local aún no tiene precisión suficiente, garantizando altitudes y desniveles exactos en toda España.
 */
let elevationFetchCounter = 0;
async function refreshPlannerElevationsFromDemAPI() {
  if (plannerCoords.length < 2) return;
  const reqId = ++elevationFetchCounter;

  try {
    // Muestrear hasta 80 puntos distribuidos uniformemente a lo largo de la ruta
    const n = plannerCoords.length;
    const maxSample = Math.min(80, n);
    const sampleIndices = [];
    for (let i = 0; i < maxSample; i++) {
      const idx = Math.min(n - 1, Math.round((i / Math.max(1, maxSample - 1)) * (n - 1)));
      if (sampleIndices.length === 0 || sampleIndices[sampleIndices.length - 1] !== idx) {
        sampleIndices.push(idx);
      }
    }

    const lats = sampleIndices.map((idx) => plannerCoords[idx][1].toFixed(5)).join(',');
    const lngs = sampleIndices.map((idx) => plannerCoords[idx][0].toFixed(5)).join(',');
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
    const data = await res.json();
    if (reqId !== elevationFetchCounter || !Array.isArray(data?.elevation) || data.elevation.length !== sampleIndices.length) {
      return;
    }

    // Interpolar suavemente la altitud real entre los puntos muestreados
    for (let s = 0; s < sampleIndices.length - 1; s++) {
      const idxA = sampleIndices[s];
      const idxB = sampleIndices[s + 1];
      const eleA = Number(data.elevation[s]);
      const eleB = Number(data.elevation[s + 1]);
      if (Number.isNaN(eleA) || Number.isNaN(eleB)) continue;

      for (let k = idxA; k <= idxB; k++) {
        const ratio = idxB === idxA ? 0 : (k - idxA) / (idxB - idxA);
        plannerCoords[k][2] = Number((eleA + (eleB - eleA) * ratio).toFixed(2));
      }
    }

    // Recalcular el perfil y pendientes con las cotas reales
    let runningKm = 0;
    const newProfile = [];
    for (let i = 0; i < plannerCoords.length; i++) {
      const curr = plannerCoords[i];
      let grade = 0;
      if (i > 0) {
        const prev = plannerCoords[i - 1];
        const dMeters = turf.distance(turf.point([prev[0], prev[1]]), turf.point([curr[0], curr[1]]), {
          units: 'meters'
        });
        runningKm += dMeters / 1000;
        let lookBackIdx = i - 1;
        let winMeters = dMeters;
        while (lookBackIdx > 0 && winMeters < 35) {
          lookBackIdx--;
          winMeters = turf.distance(
            turf.point([plannerCoords[lookBackIdx][0], plannerCoords[lookBackIdx][1]]),
            turf.point([curr[0], curr[1]]),
            { units: 'meters' }
          );
        }
        if (winMeters > 3) {
          grade = Number(Math.max(-28, Math.min(28, ((curr[2] - plannerCoords[lookBackIdx][2]) / winMeters) * 100)).toFixed(1));
        }
      }
      newProfile.push({
        distance: Number(runningKm.toFixed(3)),
        elevation: Math.round(curr[2]),
        rawElevation: curr[2],
        grade
      });
    }

    plannerElevationProfile = newProfile;
    updatePlannerMapDisplay();
  } catch {
    // Si no hay red para Open-Meteo Elevation, se mantiene la altitud del DEM de Mapbox
  }
}

function computeCumulativeElevationGainLoss(coordsArray) {
  if (!coordsArray || coordsArray.length < 2) {
    return { gain: 0, loss: 0 };
  }

  // Algoritmo de histéresis con ancla (acumula toda subida/bajada continua sin descartar pendientes suaves por culpa de puntos intermedios cercanos)
  let gain = 0;
  let loss = 0;
  let anchorEle = Number(coordsArray[0][2]) || 0;
  const thresholdMeters = 0.65;

  for (let i = 1; i < coordsArray.length; i++) {
    const currEle = Number(coordsArray[i][2]) || 0;
    const diff = currEle - anchorEle;
    if (diff >= thresholdMeters) {
      gain += diff;
      anchorEle = currEle;
    } else if (diff <= -thresholdMeters) {
      loss += Math.abs(diff);
      anchorEle = currEle;
    }
  }

  // Garantizar coherencia física: el desnivel positivo nunca puede ser menor que la diferencia neta (Altitud fin - Altitud inicio)
  const netDiff = (Number(coordsArray[coordsArray.length - 1][2]) || 0) - (Number(coordsArray[0][2]) || 0);
  if (netDiff > 0 && gain < netDiff) {
    gain = netDiff;
  } else if (netDiff < 0 && loss < Math.abs(netDiff)) {
    loss = Math.abs(netDiff);
  }

  return {
    gain: Math.round(gain),
    loss: Math.round(loss)
  };
}

function getPlannerMetrics() {
  if (plannerCoords.length < 2) {
    return { distanceMeters: 0, distanceKm: 0, elevationGain: 0, elevationLoss: 0, estimatedTimeSec: 0 };
  }

  const line = turf.lineString(plannerCoords.map((c) => [c[0], c[1]]));
  const distanceKm = turf.length(line, { units: 'kilometers' });
  const distanceMeters = Math.round(distanceKm * 1000);

  const { gain, loss } = computeCumulativeElevationGainLoss(plannerCoords);

  const targetSpeedKmh = Math.max(8, parseFloat(document.getElementById('planner-speed')?.value) || 25);
  // Penalización realista por desnivel positivo (+1 min por cada 15m de subida adicional)
  const baseSec = (distanceKm / targetSpeedKmh) * 3600;
  const climbPenaltySec = (gain / 15) * 45;
  const estimatedTimeSec = Math.round(baseSec + climbPenaltySec);

  return {
    distanceMeters,
    distanceKm,
    elevationGain: gain,
    elevationLoss: loss,
    estimatedTimeSec
  };
}

function updatePlannerMapDisplay() {
  plannerVertexMarkers.forEach((m) => m.remove());
  plannerVertexMarkers = [];
  plannerKmMarkers.forEach((m) => m.remove());
  plannerKmMarkers = [];

  if (plannerMap) {
    plannerWaypoints.forEach((coord, idx) => {
      const el = document.createElement('div');
      const isFirst = idx === 0;
      const isLast = idx === plannerWaypoints.length - 1 && plannerWaypoints.length > 1;
      if (isFirst || isLast) {
        el.className = `route-pin ${isFirst ? 'start' : 'finish'}`;
        el.innerText = isFirst ? 'Inicio' : 'Meta';
      } else {
        el.className = 'seg-draw-vertex';
        el.title = `Punto de paso ${idx + 1}`;
      }
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([coord[0], coord[1]]).addTo(plannerMap);
      plannerVertexMarkers.push(marker);
    });

    if (plannerMap.getSource('planner-route-source')) {
      const features =
        plannerCoords.length >= 2
          ? [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: plannerCoords
                }
              }
            ]
          : [];
      plannerMap.getSource('planner-route-source').setData({
        type: 'FeatureCollection',
        features
      });
    }

    // Hitos kilométricos automáticos sobre la ruta planificada
    if (plannerCoords.length >= 2) {
      const line = turf.lineString(plannerCoords.map((c) => [c[0], c[1]]));
      const totalKm = turf.length(line, { units: 'kilometers' });
      const stepKm = totalKm > 40 ? 10 : totalKm > 15 ? 5 : totalKm > 4 ? 2 : 1;
      for (let km = stepKm; km < totalKm - stepKm * 0.35; km += stepKm) {
        const pt = turf.along(line, km, { units: 'kilometers' });
        const kmEl = document.createElement('div');
        kmEl.className = 'planner-km-marker';
        kmEl.innerText = `${km} km`;
        const kmMarker = new mapboxgl.Marker({ element: kmEl }).setLngLat(pt.geometry.coordinates).addTo(plannerMap);
        plannerKmMarkers.push(kmMarker);
      }
    }
  }

  const metrics = getPlannerMetrics();
  const distHud = document.getElementById('planner-hud-dist');
  const gainHud = document.getElementById('planner-hud-gain');
  const lossHud = document.getElementById('planner-hud-loss');
  const timeHud = document.getElementById('planner-hud-time');
  const wpBadge = document.getElementById('planner-waypoints-badge');
  const statusEl = document.getElementById('planner-status-text');

  if (distHud) distHud.innerHTML = `${metrics.distanceKm.toFixed(2)} <small>km</small>`;
  if (gainHud) gainHud.innerHTML = `+${metrics.elevationGain} <small>m</small>`;
  if (lossHud) lossHud.innerHTML = `-${metrics.elevationLoss} <small>m</small>`;
  if (timeHud) timeHud.innerText = formatDuration(metrics.estimatedTimeSec);
  if (wpBadge) {
    const n = plannerWaypoints.length;
    wpBadge.innerText = `${n} ${n === 1 ? 'punto' : 'puntos'}`;
  }

  if (statusEl) {
    if (plannerWaypoints.length === 0) {
      statusEl.innerText = 'Haz clic en el mapa para situar el punto de salida';
    } else if (plannerWaypoints.length === 1) {
      statusEl.innerText = 'Salida fijada · haz clic en el mapa para ir trazando la ruta';
    } else {
      statusEl.innerText = `Ruta de ${metrics.distanceKm.toFixed(2)} km (+${metrics.elevationGain} m) · sigue añadiendo puntos o guárdala`;
    }
  }

  drawPlannerElevationChart();
}

function drawPlannerElevationChart(hoverDistanceKm = null) {
  const canvas = document.getElementById('planner-elevation-canvas');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 640;
  const cssHeight = canvas.clientHeight || 96;

  if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const labelColor = isDark ? '#6e7787' : '#8a92a0';

  if (!plannerElevationProfile || plannerElevationProfile.length < 2) {
    ctx.fillStyle = labelColor;
    ctx.font = '11.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Traza una ruta (y pulsa Simular meteo) para ver los gráficos sincronizados con el mapa',
      cssWidth / 2,
      cssHeight / 2 + 4
    );
    return;
  }

  const padL = 42;
  const padR = 12;
  const padT = 10;
  const padB = 18;
  const w = cssWidth - padL - padR;
  const h = cssHeight - padT - padB;

  const maxDist = Math.max(0.1, plannerElevationProfile[plannerElevationProfile.length - 1].distance);

  // Construir serie de datos según la pestaña activa: 'elevation' | 'wind' | 'temp' | 'rain' | 'humidity' | 'uv'
  let dataPoints = [];
  let unit = 'm';
  let strokeColor = '#f24e1e';
  let fillRgbaTop = 'rgba(242, 78, 30, 0.25)';

  if (plannerActiveChartType === 'elevation' || plannerWeatherCheckpoints.length < 2) {
    dataPoints = plannerElevationProfile.map((p) => ({ distance: p.distance, val: p.elevation }));
    unit = 'm';
    strokeColor = '#f24e1e';
    fillRgbaTop = 'rgba(242, 78, 30, 0.25)';
  } else {
    dataPoints = plannerWeatherCheckpoints.map((cp) => {
      let val = cp.tempC;
      if (plannerActiveChartType === 'wind') val = cp.windSpeedKmh;
      else if (plannerActiveChartType === 'temp') val = cp.tempC;
      else if (plannerActiveChartType === 'rain') val = cp.rainProb;
      else if (plannerActiveChartType === 'humidity') val = cp.humidity ?? 55;
      else if (plannerActiveChartType === 'uv') val = cp.uvIndex ?? 3;
      return { distance: cp.distKm, val };
    });

    if (plannerActiveChartType === 'wind') {
      unit = 'km/h';
      strokeColor = '#0284c7';
      fillRgbaTop = 'rgba(2, 132, 199, 0.24)';
    } else if (plannerActiveChartType === 'temp') {
      unit = '°C';
      strokeColor = '#f59e0b';
      fillRgbaTop = 'rgba(245, 158, 11, 0.25)';
    } else if (plannerActiveChartType === 'rain') {
      unit = '%';
      strokeColor = '#3b82f6';
      fillRgbaTop = 'rgba(59, 130, 246, 0.24)';
    } else if (plannerActiveChartType === 'humidity') {
      unit = '%';
      strokeColor = '#0d9488';
      fillRgbaTop = 'rgba(13, 148, 136, 0.24)';
    } else if (plannerActiveChartType === 'uv') {
      unit = 'UV';
      strokeColor = '#9333ea';
      fillRgbaTop = 'rgba(147, 51, 234, 0.24)';
    }
  }

  const vals = dataPoints.map((d) => d.val);
  let extraVals = [];
  if (plannerActiveChartType === 'wind' && plannerWeatherCheckpoints.length >= 2) {
    extraVals = plannerWeatherCheckpoints.map((cp) => cp.windGustsKmh ?? cp.windSpeedKmh * 1.35);
  } else if (plannerActiveChartType === 'temp' && plannerWeatherCheckpoints.length >= 2) {
    extraVals = plannerWeatherCheckpoints.map((cp) => cp.apparentTempC ?? cp.tempC - 1);
  }
  const allVals = [...vals, ...extraVals];
  const minVal = plannerActiveChartType === 'rain' || plannerActiveChartType === 'uv' ? 0 : Math.min(...allVals);
  const maxVal =
    plannerActiveChartType === 'rain' ? Math.max(50, ...allVals) : Math.max(minVal + 4, ...allVals);
  const span = Math.max(4, maxVal - minVal);

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,19,24,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const y = padT + (h / 2) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssWidth - padR, y);
    ctx.stroke();

    const val = Math.round(maxVal - (span / 2) * i);
    ctx.fillStyle = labelColor;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${val}${unit}`, padL - 5, y + 3);
  }

  ctx.beginPath();
  dataPoints.forEach((pt, idx) => {
    const x = padL + (pt.distance / maxDist) * w;
    const y = padT + h - ((pt.val - minVal) / span) * h;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
  grad.addColorStop(0, fillRgbaTop);
  grad.addColorStop(1, 'rgba(242, 78, 30, 0.01)');

  ctx.lineTo(padL + w, padT + h);
  ctx.lineTo(padL, padT + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  dataPoints.forEach((pt, idx) => {
    const x = padL + (pt.distance / maxDist) * w;
    const y = padT + h - ((pt.val - minVal) / span) * h;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // Si estamos en "Viento", dibujar también la curva naranja de Rachas de viento (windGustsKmh)
  if (plannerActiveChartType === 'wind' && plannerWeatherCheckpoints.length >= 2) {
    ctx.beginPath();
    plannerWeatherCheckpoints.forEach((cp, idx) => {
      const x = padL + (cp.distKm / maxDist) * w;
      const gustVal = cp.windGustsKmh ?? Number((cp.windSpeedKmh * 1.38).toFixed(1));
      const y = padT + h - ((gustVal - minVal) / span) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.65;
    ctx.stroke();
  }

  // Si estamos en "Temperatura", dibujar también la curva naranja de Sensación térmica (apparentTempC)
  if (plannerActiveChartType === 'temp' && plannerWeatherCheckpoints.length >= 2) {
    ctx.beginPath();
    plannerWeatherCheckpoints.forEach((cp, idx) => {
      const x = padL + (cp.distKm / maxDist) * w;
      const appVal = cp.apparentTempC ?? cp.tempC - 1;
      const y = padT + h - ((appVal - minVal) / span) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Si estamos en "Lluvia y Nubes", dibujar también la línea punteada de nubosidad (%)
  if (plannerActiveChartType === 'rain' && plannerWeatherCheckpoints.length >= 2) {
    ctx.beginPath();
    plannerWeatherCheckpoints.forEach((cp, idx) => {
      const x = padL + (cp.distKm / maxDist) * w;
      const y = padT + h - (((cp.cloudCover ?? 20) - minVal) / span) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Cursor sincronizado al pasar el dedo/ratón
  if (hoverDistanceKm !== null && hoverDistanceKm >= 0) {
    const curX = padL + (Math.min(hoverDistanceKm, maxDist) / maxDist) * w;
    ctx.strokeStyle = isDark ? '#f8fafc' : '#111318';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + h);
    ctx.stroke();

    const activePt = dataPoints.find((p) => p.distance >= hoverDistanceKm) || dataPoints[dataPoints.length - 1];
    if (activePt) {
      const curY = padT + h - ((activePt.val - minVal) / span) * h;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.fillStyle = labelColor;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('0 km', padL, cssHeight - 3);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxDist.toFixed(1)} km`, cssWidth - padR, cssHeight - 3);
}

function clearPlannerWeatherOverlay() {
  plannerWeatherMarkers.forEach((m) => m.remove());
  plannerWeatherMarkers = [];
  plannerWeatherCheckpoints = [];

  if (plannerMap && plannerMap.getSource('planner-wind-segments-source')) {
    plannerMap.getSource('planner-wind-segments-source').setData({
      type: 'FeatureCollection',
      features: []
    });
  }

  const legend = document.getElementById('planner-wind-legend');
  if (legend) legend.style.display = 'none';

  const resultsBox = document.getElementById('planner-weather-results');
  if (resultsBox) resultsBox.style.display = 'none';
}

function clearPlannerRoute() {
  plannerWaypoints = [];
  plannerWaypointsOnWay = [];
  plannerLegs = [];
  plannerCoords = [];
  plannerElevationProfile = [];
  activePlannedRouteId = null;
  plannerBaseActivityId = null;
  const baseSelect = document.getElementById('planner-base-activity-select');
  if (baseSelect) baseSelect.value = '';
  clearPlannerWeatherOverlay();
  updatePlannerMapDisplay();
}

/**
 * Carga una actividad ya realizada dentro del Planificador de Rutas para partir de ella,
 * modificarla o simular el tiempo y viento para un día y velocidad media determinados.
 */
async function loadCompletedActivityIntoPlanner(activityId) {
  if (!activityId) {
    clearPlannerRoute();
    return;
  }

  try {
    const res = await apiFetch(`/api/activities/${activityId}`);
    const data = await res.json();
    if (!data.success || !data.activity) return;

    const act = data.activity;
    const feature = act.geojson?.features?.find(
      (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
    );
    if (!feature) return;

    const coords =
      feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
    if (!coords || coords.length < 2) return;

    clearPlannerWeatherOverlay();
    plannerBaseActivityId = act._id;
    activePlannedRouteId = null;
    plannerCoords = coords.map((c) => [Number(c[0]), Number(c[1]), Number(c[2] || 0)]);
    plannerWaypoints = [
      [plannerCoords[0][0], plannerCoords[0][1]],
      [plannerCoords[plannerCoords.length - 1][0], plannerCoords[plannerCoords.length - 1][1]]
    ];
    plannerWaypointsOnWay = [true, true];
    plannerLegs = [plannerCoords];

    if (act.elevationProfile && act.elevationProfile.length >= 2) {
      plannerElevationProfile = act.elevationProfile;
    } else {
      rebuildPlannerRouteAndElevation();
    }

    document.getElementById('planner-title').value = `${act.title} (Planificada)`;
    document.getElementById('planner-sport').value = act.type || 'Ride';
    document.getElementById('planner-speed').value = act.averageSpeed ? Number(act.averageSpeed.toFixed(1)) : 25;
    document.getElementById('planner-notes').value = act.description || '';

    const bikeSelect = document.getElementById('planner-bike-select');
    if (bikeSelect) {
      const matchedGear = gearList.find(
        (g) => (act.gearId && String(g._id) === String(act.gearId)) || (act.gear && g.name.toLowerCase() === act.gear.toLowerCase())
      );
      if (matchedGear) bikeSelect.value = matchedGear._id;
    }

    updatePlannerMapDisplay();

    if (plannerMap && plannerCoords.length >= 2) {
      const bbox = turf.bbox({ type: 'Feature', geometry: { type: 'LineString', coordinates: plannerCoords } });
      plannerMap.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]]
        ],
        { padding: { top: 80, bottom: 190, left: 70, right: 70 }, maxZoom: 15, duration: 900 }
      );
    }

    // Si ya hay fecha seleccionada, simular automáticamente el viento y tiempo
    const dateVal = document.getElementById('planner-date')?.value;
    if (dateVal) {
      await simulatePlannerRouteWeather();
    }
  } catch (err) {
    console.error('Error cargando actividad base en planificador:', err);
  }
}

function populatePlannerBaseActivitiesDropdown(activities) {
  allUserActivitiesCache = activities || [];
  const selectEl = document.getElementById('planner-base-activity-select');
  if (!selectEl) return;

  const currentVal = selectEl.value;
  let html = `<option value="">— Diseñar ruta nueva desde cero en el mapa —</option>`;
  if (allUserActivitiesCache.length > 0) {
    html += `<optgroup label="Tus rutas ya realizadas (${allUserActivitiesCache.length})">`;
    html += allUserActivitiesCache
      .map(
        (a) =>
          `<option value="${a._id}">${a.title} (${formatDistance(a.distance)} km · +${a.totalElevationGain || 0}m)</option>`
      )
      .join('');
    html += `</optgroup>`;
  }
  selectEl.innerHTML = html;
  if ([...selectEl.options].some((o) => o.value === currentVal)) {
    selectEl.value = currentVal;
  }
}

function degreeToCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function getWeatherIconAndLabel(wmoCode, rainProb) {
  if (rainProb >= 55 || (wmoCode >= 51 && wmoCode <= 99)) {
    return { icon: '🌧️', label: 'Lluvia' };
  }
  if (rainProb >= 30 || wmoCode === 3) {
    return { icon: '☁️', label: 'Nublado' };
  }
  if (wmoCode === 1 || wmoCode === 2) {
    return { icon: '⛅', label: 'Claros' };
  }
  return { icon: '☀️', label: 'Bueno / Sol' };
}

/**
 * Simula la meteorología y el impacto real del viento en cada tramo y minuto de la ruta
 * teniendo en cuenta:
 * - La fecha y hora de salida
 * - La velocidad media estimada por el ciclista (y el desnivel de cada kilómetro)
 * - La dirección de marcha de la bicicleta en cada punto vs la dirección de donde sopla el viento
 */
async function simulatePlannerRouteWeather() {
  if (plannerCoords.length < 2) {
    alert('Primero diseña una ruta en el mapa o selecciona una ruta ya realizada arriba.');
    return;
  }

  const dateInput = document.getElementById('planner-date');
  const timeInput = document.getElementById('planner-departure-time');
  const calcBtn = document.getElementById('planner-calc-weather-btn');

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  const plannedDate = dateInput?.value || new Date().toISOString().slice(0, 10);
  const departureTime = timeInput?.value || '09:00';
  const targetSpeedKmh = Math.max(8, parseFloat(document.getElementById('planner-speed')?.value) || 25);

  if (calcBtn) {
    calcBtn.disabled = true;
    calcBtn.innerText = 'Consultando previsión por tramos…';
  }

  try {
    const line = turf.lineString(plannerCoords.map((c) => [c[0], c[1]]));
    const totalKm = turf.length(line, { units: 'kilometers' });
    const numCheckpoints = Math.min(8, Math.max(4, Math.ceil(totalKm / 4) + 1));

    const [depHour, depMin] = departureTime.split(':').map((n) => parseInt(n, 10) || 0);
    const startEpochMs = new Date(`${plannedDate}T${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}:00`).getTime();

    // Construir puntos de control espacio-temporales a lo largo de la ruta
    const rawCheckpoints = [];
    for (let i = 0; i < numCheckpoints; i++) {
      const ratio = i / Math.max(1, numCheckpoints - 1);
      const distKm = Number((ratio * totalKm).toFixed(2));
      const pt = turf.along(line, distKm, { units: 'kilometers' });
      const lookAheadDist = Math.min(totalKm, distKm + Math.max(0.15, totalKm * 0.04));
      const lookBackDist = Math.max(0, distKm - Math.max(0.15, totalKm * 0.04));
      const ptA = turf.along(line, i === numCheckpoints - 1 ? lookBackDist : distKm, { units: 'kilometers' });
      const ptB = turf.along(line, i === numCheckpoints - 1 ? distKm : lookAheadDist, { units: 'kilometers' });
      const rawBearing = turf.bearing(ptA, ptB);
      const bikeBearing = (rawBearing + 360) % 360;

      // Tiempo acumulado hasta este km (ajustado por el desnivel acumulado hasta ese punto)
      let gainUpToHere = 0;
      for (let j = 1; j < plannerElevationProfile.length; j++) {
        if (plannerElevationProfile[j].distance <= distKm) {
          const d = plannerElevationProfile[j].elevation - plannerElevationProfile[j - 1].elevation;
          if (d > 0) gainUpToHere += d;
        }
      }
      const elapsedSeconds = Math.round((distKm / targetSpeedKmh) * 3600 + (gainUpToHere / 15) * 45);
      const arrivalDate = new Date(startEpochMs + elapsedSeconds * 1000);
      const arrivalTimeStr = arrivalDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const arrivalHourIso = `${plannedDate}T${String(arrivalDate.getHours()).padStart(2, '0')}:00`;

      rawCheckpoints.push({
        index: i,
        distKm,
        coord: pt.geometry.coordinates,
        bikeBearing: Math.round(bikeBearing),
        elapsedSeconds,
        arrivalTimeStr,
        arrivalHourIso,
        arrivalHour: arrivalDate.getHours()
      });
    }

    // Consultar Open-Meteo para LAS COORDENADAS EXACTAS de cada punto de control de la ruta (incluyendo nubosidad, humedad e índice UV)
    const latsParam = rawCheckpoints.map((cp) => cp.coord[1].toFixed(4)).join(',');
    const lngsParam = rawCheckpoints.map((cp) => cp.coord[0].toFixed(4)).join(',');
    let hourlyDataByPoint = [];
    try {
      const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latsParam}&longitude=${lngsParam}&hourly=temperature_2m,apparent_temperature,precipitation_probability,cloud_cover,relative_humidity_2m,uv_index,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&start_date=${plannedDate}&end_date=${plannedDate}&timezone=auto`;
      const meteoRes = await fetch(meteoUrl);
      const meteoJson = await meteoRes.json();
      if (Array.isArray(meteoJson)) {
        hourlyDataByPoint = meteoJson.map((item) => item?.hourly || null);
      } else if (meteoJson && meteoJson.hourly) {
        hourlyDataByPoint = rawCheckpoints.map(() => meteoJson.hourly);
      }
    } catch {
      hourlyDataByPoint = [];
    }

    // Evaluar cada punto con los datos horarios locales de su coordenada y la física del viento relativo al rumbo del ciclista
    plannerWeatherCheckpoints = rawCheckpoints.map((cp, ptIndex) => {
      const hourlyData = hourlyDataByPoint[ptIndex] || hourlyDataByPoint[0] || null;
      let tempC = 15;
      let apparentTempC = 14;
      let rainProb = 10;
      let cloudCover = 25;
      let humidity = 55;
      let uvIndex = 4;
      let wmoCode = 1;
      let windSpeedKmh = 14;
      let windGustsKmh = 21;
      let windFromDeg = 225; // SO por defecto

      if (hourlyData) {
        let hIdx = hourlyData.time.findIndex((t) => t.startsWith(cp.arrivalHourIso.slice(0, 13)));
        if (hIdx === -1) hIdx = Math.min(cp.arrivalHour, hourlyData.time.length - 1);
        if (hIdx >= 0) {
          tempC = Math.round(hourlyData.temperature_2m?.[hIdx] ?? 15);
          apparentTempC = Math.round(hourlyData.apparent_temperature?.[hIdx] ?? tempC - 1);
          rainProb = Math.round(hourlyData.precipitation_probability?.[hIdx] ?? 0);
          cloudCover = Math.round(hourlyData.cloud_cover?.[hIdx] ?? 20);
          humidity = Math.round(hourlyData.relative_humidity_2m?.[hIdx] ?? 55);
          uvIndex = Number((hourlyData.uv_index?.[hIdx] ?? 3).toFixed(1));
          wmoCode = hourlyData.weather_code?.[hIdx] ?? 1;
          windSpeedKmh = Number((hourlyData.wind_speed_10m?.[hIdx] ?? 12).toFixed(1));
          windGustsKmh = Number((hourlyData.wind_gusts_10m?.[hIdx] ?? windSpeedKmh * 1.4).toFixed(1));
          windFromDeg = Math.round(hourlyData.wind_direction_10m?.[hIdx] ?? 220);
        }
      } else {
        // Variación horaria realista si la fecha está fuera del rango de 16 días de Open-Meteo
        tempC = Math.round(12 + Math.sin(((cp.arrivalHour - 8) / 12) * Math.PI) * 7);
        apparentTempC = tempC - 1;
        rainProb = 15;
        cloudCover = 20;
        humidity = Math.round(65 - Math.sin(((cp.arrivalHour - 8) / 12) * Math.PI) * 20);
        uvIndex = Math.max(0, Number((Math.sin(((cp.arrivalHour - 7) / 12) * Math.PI) * 6).toFixed(1)));
        windSpeedKmh = Number((13 + (cp.index % 3) * 2.5).toFixed(1));
        windGustsKmh = Number((windSpeedKmh * 1.42).toFixed(1));
        windFromDeg = 230;
      }

      // Ángulo entre la dirección DE DONDE viene el viento (windFromDeg) y hacia donde avanza la bici (bikeBearing)
      const angleRad = ((windFromDeg - cp.bikeBearing) * Math.PI) / 180;
      // Si windFromDeg == bikeBearing (cos = 1), el viento viene de cara -> tailwindComp negativo (En contra)
      // Si windFromDeg == bikeBearing + 180 (cos = -1), el viento viene por la espalda -> tailwindComp positivo (A favor)
      const tailwindCompKmh = Number((-windSpeedKmh * Math.cos(angleRad)).toFixed(1));
      const crosswindCompKmh = Number((windSpeedKmh * Math.sin(angleRad)).toFixed(1));

      let windEffectType = 'crosswind'; // 'tailwind', 'headwind', 'crosswind'
      let windEffectLabel = 'Lateral';
      let windColor = '#eab308';

      if (tailwindCompKmh >= 2.8) {
        windEffectType = 'tailwind';
        windEffectLabel = 'A favor';
        windColor = '#16a34a';
      } else if (tailwindCompKmh <= -2.8) {
        windEffectType = 'headwind';
        windEffectLabel = 'En contra';
        windColor = '#ef4444';
      } else {
        windEffectType = 'crosswind';
        windEffectLabel = crosswindCompKmh >= 0 ? 'Lat. der.' : 'Lat. izq.';
        windColor = '#eab308';
      }

      // Impacto estimado en velocidad del ciclista (km/h) y esfuerzo equivalente en vatios (W)
      const speedDeltaKmh = Number((tailwindCompKmh * 0.19).toFixed(1));
      const wattsDelta = Math.round(-tailwindCompKmh * 1.85);
      const windBlowsTowardsDeg = (windFromDeg + 180) % 360;
      const weatherInfo = getWeatherIconAndLabel(wmoCode, rainProb);

      return {
        ...cp,
        tempC,
        apparentTempC,
        rainProb,
        cloudCover,
        humidity,
        uvIndex,
        weatherIcon: weatherInfo.icon,
        weatherLabel: weatherInfo.label,
        windSpeedKmh,
        windGustsKmh,
        windFromDeg,
        windCardinal: degreeToCardinal(windFromDeg),
        windBlowsTowardsDeg,
        tailwindCompKmh,
        windEffectType,
        windEffectLabel,
        windColor,
        speedDeltaKmh,
        wattsDelta
      };
    });

    renderPlannerWeatherOnMapAndPanel(plannedDate, departureTime);
  } catch (err) {
    console.error('Error simulando meteo en ruta:', err);
    alert('No se pudo calcular la previsión meteorológica: ' + err.message);
  } finally {
    if (calcBtn) {
      calcBtn.disabled = false;
      calcBtn.innerText = 'Simular meteo';
    }
  }
}

function getColorForSegmentByMode(cpA) {
  if (plannerRouteColorMode === 'temp') {
    const t = cpA.tempC ?? 16;
    if (t < 9) return '#0284c7'; // Frío (<9°C)
    if (t <= 16) return '#16a34a'; // Fresco óptimo (9-16°C)
    if (t <= 23) return '#f59e0b'; // Templado (17-23°C)
    return '#ef4444'; // Calor (>23°C)
  }
  if (plannerRouteColorMode === 'rain') {
    const r = cpA.rainProb ?? 0;
    if (r < 20) return '#16a34a';
    if (r < 50) return '#eab308';
    return '#0284c7';
  }
  if (plannerRouteColorMode === 'grade') {
    const pt = plannerElevationProfile.find((p) => p.distance >= cpA.distKm);
    const g = pt ? pt.grade : 0;
    if (g < 2) return '#16a34a';
    if (g < 6) return '#eab308';
    if (g < 10) return '#f97316';
    return '#ef4444';
  }
  return cpA.windColor;
}

function updatePlannerColorLegend() {
  const legend = document.getElementById('planner-wind-legend');
  const content = document.getElementById('planner-legend-content');
  if (!legend || !content) return;

  if (plannerRouteColorMode === 'temp') {
    content.innerHTML = `
      Ruta pintada por Temperatura:
      <span class="wind-legend-item"><i class="wind-dot" style="background:#0284c7"></i> &lt;9°C Frío</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#16a34a"></i> 9–16°C Óptimo</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#f59e0b"></i> 17–23°C Templado</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#ef4444"></i> &gt;23°C Calor</span>
    `;
  } else if (plannerRouteColorMode === 'grade') {
    content.innerHTML = `
      Ruta pintada por Pendiente:
      <span class="wind-legend-item"><i class="wind-dot" style="background:#16a34a"></i> &lt;2% Llano</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#eab308"></i> 2–6% Moderado</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#f97316"></i> 6–10% Duro</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#ef4444"></i> &gt;10% Rampa</span>
    `;
  } else if (plannerRouteColorMode === 'rain') {
    content.innerHTML = `
      Ruta pintada por Lluvia:
      <span class="wind-legend-item"><i class="wind-dot" style="background:#16a34a"></i> &lt;20% Seco</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#eab308"></i> 20–50% Riesgo</span>
      <span class="wind-legend-item"><i class="wind-dot" style="background:#0284c7"></i> &gt;50% Lluvia</span>
    `;
  } else {
    content.innerHTML = `
      Impacto del viento en ruta:
      <span class="wind-legend-item"><i class="wind-dot tailwind"></i> A favor (+vel / -esfuerzo)</span>
      <span class="wind-legend-item"><i class="wind-dot crosswind"></i> Lateral</span>
      <span class="wind-legend-item"><i class="wind-dot headwind"></i> En contra (-vel / +esfuerzo)</span>
    `;
  }
}

function repaintPlannerRouteSegmentsOnMap() {
  if (!plannerMap || plannerCoords.length < 2) return;
  const line = turf.lineString(plannerCoords.map((c) => [c[0], c[1]]));

  // Si no hay checkpoints meteo pero pidieron pintar por pendiente, usamos el perfil de elevación
  const pts =
    plannerWeatherCheckpoints.length >= 2
      ? plannerWeatherCheckpoints
      : plannerElevationProfile.map((p) => ({ distKm: p.distance, windColor: '#f24e1e', tempC: 16, rainProb: 0 }));

  const segmentFeatures = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const cpA = pts[i];
    const cpB = pts[i + 1];
    if (cpB.distKm > cpA.distKm) {
      const sliced = turf.lineSliceAlong(line, cpA.distKm, cpB.distKm, { units: 'kilometers' });
      segmentFeatures.push({
        type: 'Feature',
        properties: {
          color: getColorForSegmentByMode(cpA)
        },
        geometry: sliced.geometry
      });
    }
  }

  if (plannerMap.getSource('planner-wind-segments-source')) {
    plannerMap.getSource('planner-wind-segments-source').setData({
      type: 'FeatureCollection',
      features: segmentFeatures
    });
  }

  const legend = document.getElementById('planner-wind-legend');
  if (legend) {
    legend.style.display = 'flex';
    updatePlannerColorLegend();
  }
}

function renderPlannerWeatherOnMapAndPanel(plannedDate, departureTime) {
  plannerWeatherMarkers.forEach((m) => m.remove());
  plannerWeatherMarkers = [];

  if (!plannerMap || plannerWeatherCheckpoints.length < 2) return;

  repaintPlannerRouteSegmentsOnMap();
  drawPlannerElevationChart();

  // 2. Colocar marcadores meteorológicos con hora de paso, flecha de viento y efecto (+km/h / W) sobre el mapa
  plannerWeatherCheckpoints.forEach((cp) => {
    const el = document.createElement('div');
    el.className = `map-weather-pin ${cp.windEffectType}`;

    const speedSign = cp.speedDeltaKmh > 0 ? '+' : '';
    const wattsText =
      cp.wattsDelta < 0 ? `${cp.wattsDelta}W ayuda` : cp.wattsDelta > 0 ? `+${cp.wattsDelta}W esf.` : '0W';

    el.innerHTML = `
      <div class="mw-pin-top">
        <span>${cp.arrivalTimeStr} · Km ${cp.distKm.toFixed(1)}</span>
        <span>${cp.weatherIcon} ${cp.tempC}°C${cp.rainProb >= 25 ? ` · ${cp.rainProb}%💧` : ''}</span>
      </div>
      <div class="mw-pin-wind">
        <span class="wind-arrow-svg" style="transform: rotate(${cp.windBlowsTowardsDeg}deg);" title="Dirección hacia la que sopla el viento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </span>
        <span>${cp.windSpeedKmh} km/h (${cp.windCardinal}) · <strong>${cp.windEffectLabel}</strong></span>
      </div>
      <div class="mw-pin-impact ${cp.windEffectType}">
        ${speedSign}${cp.speedDeltaKmh} km/h (${wattsText})
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: el }).setLngLat([cp.coord[0], cp.coord[1]]).addTo(plannerMap);
    plannerWeatherMarkers.push(marker);
  });

  const legend = document.getElementById('planner-wind-legend');
  if (legend) legend.style.display = 'flex';

  // 3. Renderizar resumen y tabla horaria en el panel derecho
  const resultsBox = document.getElementById('planner-weather-results');
  const badgeEl = document.getElementById('planner-weather-badge');
  const summaryCard = document.getElementById('planner-weather-summary-card');
  const timelineBox = document.getElementById('planner-weather-timeline');

  if (!resultsBox || !summaryCard || !timelineBox) return;
  resultsBox.style.display = 'flex';

  const temps = plannerWeatherCheckpoints.map((c) => c.tempC);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const maxRain = Math.max(...plannerWeatherCheckpoints.map((c) => c.rainProb));
  const avgWind = (
    plannerWeatherCheckpoints.reduce((s, c) => s + c.windSpeedKmh, 0) / plannerWeatherCheckpoints.length
  ).toFixed(1);
  const avgSpeedDelta = (
    plannerWeatherCheckpoints.reduce((s, c) => s + c.speedDeltaKmh, 0) / plannerWeatherCheckpoints.length
  ).toFixed(1);
  const avgWattsDelta = Math.round(
    plannerWeatherCheckpoints.reduce((s, c) => s + c.wattsDelta, 0) / plannerWeatherCheckpoints.length
  );

  const totalPts = plannerWeatherCheckpoints.length;
  const tailwindPct = Math.round(
    (plannerWeatherCheckpoints.filter((c) => c.windEffectType === 'tailwind').length / totalPts) * 100
  );
  const headwindPct = Math.round(
    (plannerWeatherCheckpoints.filter((c) => c.windEffectType === 'headwind').length / totalPts) * 100
  );
  const crosswindPct = Math.max(0, 100 - tailwindPct - headwindPct);

  const isGoodWeather = maxRain < 35;
  const verdictIcon = isGoodWeather ? '☀️' : '🌧️';
  const verdictText = isGoodWeather
    ? 'Tiempo favorable para salir en bici'
    : `Atención: ${maxRain}% prob. de lluvia en ruta`;

  if (badgeEl) {
    badgeEl.innerText = `${plannedDate} · Salida ${departureTime}`;
  }

  const netSign = Number(avgSpeedDelta) > 0 ? '+' : '';
  const netWattsLabel =
    avgWattsDelta < 0
      ? `${avgWattsDelta} W medios (ahorro de esfuerzo)`
      : avgWattsDelta > 0
        ? `+${avgWattsDelta} W medios (esfuerzo extra)`
        : 'Esfuerzo neutro';

  summaryCard.innerHTML = `
    <div class="pw-summary-verdict">
      <div>
        <div class="pw-verdict-title">${verdictIcon} ${verdictText}</div>
        <div class="pw-verdict-sub">
          Temp: <strong>${minTemp}°C – ${maxTemp}°C</strong> · Lluvia máx: <strong>${maxRain}%</strong> · Viento medio: <strong>${avgWind} km/h</strong>
        </div>
      </div>
    </div>
    <div style="font-size: 12px; color: var(--text-secondary);">
      Balance neto del viento en ti: <strong style="color: ${Number(avgSpeedDelta) >= 0 ? '#16a34a' : '#ef4444'};">${netSign}${avgSpeedDelta} km/h</strong> (${netWattsLabel})
    </div>
    <div class="pw-wind-bars">
      <div class="pw-wind-stat">
        <span class="pw-wind-stat-lbl">A favor (Ayuda)</span>
        <span class="pw-wind-stat-val tailwind">${tailwindPct}% ruta</span>
      </div>
      <div class="pw-wind-stat">
        <span class="pw-wind-stat-lbl">Viento lateral</span>
        <span class="pw-wind-stat-val crosswind">${crosswindPct}% ruta</span>
      </div>
      <div class="pw-wind-stat">
        <span class="pw-wind-stat-lbl">En contra</span>
        <span class="pw-wind-stat-val headwind">${headwindPct}% ruta</span>
      </div>
    </div>
  `;

  timelineBox.innerHTML = plannerWeatherCheckpoints
    .map((cp) => {
      const sSign = cp.speedDeltaKmh > 0 ? '+' : '';
      const wLabel = cp.wattsDelta < 0 ? `${cp.wattsDelta} W` : cp.wattsDelta > 0 ? `+${cp.wattsDelta} W` : '0 W';
      return `
        <div class="pw-checkpoint-row" data-cp-idx="${cp.index}">
          <div class="pw-cp-left">
            <span class="pw-cp-time">${cp.arrivalTimeStr} · Km ${cp.distKm.toFixed(1)}</span>
            <span class="pw-cp-weather">
              ${cp.weatherIcon} ${cp.tempC}°C · 💧${cp.rainProb}% · Viento ${cp.windSpeedKmh} km/h ${cp.windCardinal}
            </span>
          </div>
          <div class="pw-cp-right">
            <span class="mw-pin-impact ${cp.windEffectType}">${cp.windEffectLabel} (${sSign}${cp.speedDeltaKmh} km/h)</span>
            <span style="font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted);">${wLabel}</span>
          </div>
        </div>
      `;
    })
    .join('');

  timelineBox.querySelectorAll('.pw-checkpoint-row').forEach((row) => {
    row.addEventListener('click', () => {
      const cp = plannerWeatherCheckpoints[Number(row.dataset.cpIdx)];
      if (cp && plannerMap) {
        plannerMap.easeTo({
          center: [cp.coord[0], cp.coord[1]],
          zoom: Math.max(plannerMap.getZoom(), 14),
          duration: 700
        });
      }
    });
  });
}

function exportCoordsAsGPXFile(title, sportType, coords) {
  if (!coords || coords.length < 2) {
    alert('Diseña primero una ruta en el mapa con al menos 2 puntos antes de exportar el GPX.');
    return;
  }

  const safeTitle = (title || 'Ruta Planificada Route3D').trim();
  const nowIso = new Date().toISOString();
  const trkpts = coords
    .map((c) => {
      const lng = Number(c[0]).toFixed(6);
      const lat = Number(c[1]).toFixed(6);
      const ele = Math.round(Number(c[2]) || 0);
      return `      <trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`;
    })
    .join('\n');

  const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Route3D Cycling Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle.replace(/[<>&'"]/g, '')}</name>
    <time>${nowIso}</time>
  </metadata>
  <trk>
    <name>${safeTitle.replace(/[<>&'"]/g, '')}</name>
    <type>${sportType || 'Ride'}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle.toLowerCase().replace(/[^a-z0-9-_]+/gi, '-') || 'ruta-garmin'}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadPlannedRoutes() {
  const container = document.getElementById('planned-routes-list');
  const countEl = document.getElementById('planned-routes-count');

  try {
    const res = await apiFetch('/api/planned-routes');
    const data = await res.json();
    if (!data.success) return;

    savedPlannedRoutes = data.routes || [];
    if (countEl) {
      countEl.innerText = `${savedPlannedRoutes.length} ${savedPlannedRoutes.length === 1 ? 'ruta' : 'rutas'}`;
    }
    renderPlannedRoutesList();
  } catch (err) {
    console.error('Error cargando rutas planificadas:', err);
    if (container) container.innerHTML = `<p class="maint-empty">Error cargando rutas planificadas.</p>`;
  }
}

function renderPlannedRoutesList() {
  const container = document.getElementById('planned-routes-list');
  if (!container) return;

  if (savedPlannedRoutes.length === 0) {
    container.innerHTML = `<p class="maint-empty">Aún no has guardado rutas planificadas. Haz clic en el mapa para diseñar la primera.</p>`;
    return;
  }

  container.innerHTML = savedPlannedRoutes
    .map((rt) => {
      const distKm = ((rt.distanceMeters || 0) / 1000).toFixed(2);
      const isSelected = String(activePlannedRouteId) === String(rt._id);
      return `
        <div class="segment-item-card ${isSelected ? 'active' : ''}" data-plan-id="${rt._id}">
          <div class="segment-item-top">
            <div class="segment-item-title-wrap">
              <div class="segment-item-name">
                <span>${rt.title}</span>
                <span class="seg-cat-badge">${getSportName(rt.sportType)}</span>
              </div>
              <span class="segment-item-specs">
                ${distKm} km · +${rt.elevationGain || 0} m · ~${formatDuration(rt.estimatedTimeSeconds)}
              </span>
              ${rt.bikeName ? `<span style="font-size: 11.5px; color: var(--text-muted);">${rt.bikeName}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button
                class="btn-icon-only download-plan-gpx-btn"
                data-plan-id="${rt._id}"
                type="button"
                title="Descargar GPX para Garmin"
              >
                ⬇️
              </button>
              <button
                class="btn-icon-only danger delete-plan-btn"
                data-plan-id="${rt._id}"
                type="button"
                title="Eliminar ruta planificada"
              >
                ${ICONS.trash}
              </button>
            </div>
          </div>
          ${rt.notes ? `<p style="font-size: 12px; color: var(--text-secondary);">${rt.notes}</p>` : ''}
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.segment-item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.download-plan-gpx-btn') || e.target.closest('.delete-plan-btn')) return;
      const rt = savedPlannedRoutes.find((r) => String(r._id) === String(card.dataset.planId));
      if (!rt) return;

      activePlannedRouteId = rt._id;
      plannerCoords = rt.coordinates || [];
      plannerWaypoints =
        rt.waypoints && rt.waypoints.length >= 2
          ? rt.waypoints
          : [plannerCoords[0], plannerCoords[plannerCoords.length - 1]];
      plannerWaypointsOnWay = plannerWaypoints.map(() => true);
      plannerLegs = [plannerCoords];
      plannerElevationProfile = rt.elevationProfile || [];

      document.getElementById('planner-title').value = rt.title || '';
      document.getElementById('planner-sport').value = rt.sportType || 'Ride';
      document.getElementById('planner-speed').value = rt.targetSpeedKmh || 25;
      document.getElementById('planner-notes').value = rt.notes || '';
      if (document.getElementById('planner-date')) {
        document.getElementById('planner-date').value = rt.plannedDate || '';
      }
      if (document.getElementById('planner-departure-time')) {
        document.getElementById('planner-departure-time').value = rt.departureTime || '09:00';
      }
      const bikeSelect = document.getElementById('planner-bike-select');
      if (bikeSelect && rt.bikeId) bikeSelect.value = rt.bikeId;

      clearPlannerWeatherOverlay();
      updatePlannerMapDisplay();
      renderPlannedRoutesList();

      if (rt.plannedDate) {
        simulatePlannerRouteWeather();
      }

      if (plannerMap && plannerCoords.length >= 2) {
        const bbox = turf.bbox({ type: 'Feature', geometry: { type: 'LineString', coordinates: plannerCoords } });
        plannerMap.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]]
          ],
          { padding: { top: 80, bottom: 190, left: 70, right: 70 }, maxZoom: 15, duration: 900 }
        );
      }
    });
  });

  container.querySelectorAll('.download-plan-gpx-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rt = savedPlannedRoutes.find((r) => String(r._id) === String(btn.dataset.planId));
      if (rt) {
        exportCoordsAsGPXFile(rt.title, rt.sportType, rt.coordinates);
      }
    });
  });

  container.querySelectorAll('.delete-plan-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta ruta planificada?')) return;
      try {
        const res = await apiFetch(`/api/planned-routes/${btn.dataset.planId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          if (String(activePlannedRouteId) === String(btn.dataset.planId)) {
            clearPlannerRoute();
          }
          await loadPlannedRoutes();
        }
      } catch (err) {
        alert('Error eliminando ruta planificada: ' + err.message);
      }
    });
  });
}

/**
 * Buscador de municipios, puertos de montaña y regiones de toda España (Península, Baleares y Canarias)
 * usando Mapbox Geocoding filtrado a España (country=es) para mover el mapa al instante.
 */
function setupSpainLocationSearch(inputId, resultsId, getTargetMap) {
  const inputEl = document.getElementById(inputId);
  const resultsEl = document.getElementById(resultsId);
  if (!inputEl || !resultsEl) return;

  let debounceTimer = null;

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (q.length < 2) {
      resultsEl.style.display = 'none';
      resultsEl.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (!MAPBOX_TOKEN) return;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          q
        )}.json?country=es&language=es&limit=5&types=place,locality,poi,region,district&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        const features = data?.features || [];
        if (features.length === 0) {
          resultsEl.style.display = 'none';
          return;
        }

        resultsEl.innerHTML = features
          .map((f, i) => {
            const parts = (f.place_name || '').split(',');
            const mainName = parts[0] || f.text;
            const subName = parts.slice(1).join(',').trim() || 'España';
            return `
              <button type="button" class="map-loc-item" data-idx="${i}">
                <span class="map-loc-main">${mainName}</span>
                <span class="map-loc-sub">${subName}</span>
              </button>
            `;
          })
          .join('');
        resultsEl.style.display = 'flex';

        resultsEl.querySelectorAll('.map-loc-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            const feat = features[Number(btn.dataset.idx)];
            const targetMap = getTargetMap();
            if (feat && targetMap) {
              if (Array.isArray(feat.bbox) && feat.bbox.length === 4) {
                targetMap.fitBounds(
                  [
                    [feat.bbox[0], feat.bbox[1]],
                    [feat.bbox[2], feat.bbox[3]]
                  ],
                  { padding: 60, maxZoom: 14, duration: 1100 }
                );
              } else if (Array.isArray(feat.center)) {
                targetMap.flyTo({
                  center: feat.center,
                  zoom: 13.5,
                  duration: 1100
                });
              }
            }
            inputEl.value = feat?.text || '';
            resultsEl.style.display = 'none';
          });
        });
      } catch (err) {
        console.warn('Error buscando localidad en España:', err);
      }
    }, 220);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) {
      resultsEl.style.display = 'none';
    }
  });
}

/**
 * 1) FUENTES DE AGUA POTABLE (+40.000 en España vía OpenStreetMap Overpass + fuentes propias en MongoDB)
 */
async function togglePlannerWaterSources() {
  const btn = document.getElementById('planner-water-btn');
  isWaterSourcesVisible = !isWaterSourcesVisible;
  if (btn) btn.classList.toggle('active', isWaterSourcesVisible);

  waterSourceMarkers.forEach((m) => m.remove());
  waterSourceMarkers = [];

  if (!isWaterSourcesVisible || !plannerMap) return;

  const bounds = plannerMap.getBounds();
  const minLat = bounds.getSouth().toFixed(4);
  const minLng = bounds.getWest().toFixed(4);
  const maxLat = bounds.getNorth().toFixed(4);
  const maxLng = bounds.getEast().toFixed(4);

  if (btn) btn.innerHTML = '<span>💧 Buscando…</span>';

  try {
    const overpassQuery = `[out:json][timeout:10];node["amenity"="drinking_water"](${minLat},${minLng},${maxLat},${maxLng});out body 120;`;
    const [osmRes, customRes] = await Promise.all([
      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`)
        .then((r) => r.json())
        .catch(() => ({ elements: [] })),
      apiFetch(`/api/water-sources?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`)
        .then((r) => r.json())
        .catch(() => ({ sources: [] }))
    ]);

    const fountains = [];
    (customRes?.sources || []).forEach((s) => {
      fountains.push({
        name: s.name || 'Fuente añadida por ciclista',
        notes: s.notes || `Añadida por ${s.creatorName || 'ciclista'}`,
        lng: s.lng,
        lat: s.lat,
        isCustom: true
      });
    });

    (osmRes?.elements || []).forEach((el) => {
      if (el.lat && el.lon) {
        fountains.push({
          name: el.tags?.name || 'Fuente de agua potable (OSM)',
          notes: el.tags?.description || 'Agua potable pública',
          lng: el.lon,
          lat: el.lat,
          isCustom: false
        });
      }
    });

    fountains.forEach((f) => {
      const el = document.createElement('div');
      el.className = `water-source-pin ${f.isCustom ? 'user-added' : ''}`;
      el.innerHTML = `💧 ${f.name.slice(0, 18)}`;
      el.title = `${f.name}${f.notes ? ' — ' + f.notes : ''}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        alert(`💧 ${f.name}\n${f.notes}\nCoordenadas: ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`);
      });
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([f.lng, f.lat]).addTo(plannerMap);
      waterSourceMarkers.push(marker);
    });
  } finally {
    if (btn) btn.innerHTML = `<span>Fuentes (${waterSourceMarkers.length})</span>`;
  }
}

async function handleAddWaterSourceAtCoord(coord) {
  const addBtn = document.getElementById('planner-add-water-btn');
  isAddingWaterSourceMode = false;
  if (addBtn) addBtn.classList.remove('active');

  const name = prompt('Nombre o referencia de la fuente de agua potable:', 'Fuente de agua potable');
  if (!name) return;
  const notes = prompt('Indicaciones opcionales (ej: Junto a la plaza / Agua fresca todo el año):', '') || '';

  try {
    const res = await apiFetch('/api/water-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notes, lng: coord[0], lat: coord[1] })
    });
    const data = await res.json();
    if (data.success && data.source && plannerMap) {
      if (!isWaterSourcesVisible) {
        isWaterSourcesVisible = true;
        const waterBtn = document.getElementById('planner-water-btn');
        if (waterBtn) waterBtn.classList.add('active');
      }
      const el = document.createElement('div');
      el.className = 'water-source-pin user-added';
      el.innerHTML = `💧 ${data.source.name.slice(0, 18)}`;
      el.title = `${data.source.name} — ${data.source.notes}`;
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([coord[0], coord[1]]).addTo(plannerMap);
      waterSourceMarkers.push(marker);
    }
  } catch (err) {
    alert('Error guardando fuente de agua: ' + err.message);
  }
}

/**
 * 2) MAPA DE CALOR CON LAS TRAZAS REALES DE OTROS CICLISTAS EN LA ZONA
 */
async function togglePlannerCyclingHeatmap() {
  const btn = document.getElementById('planner-heatmap-btn');
  isCyclingHeatmapVisible = !isCyclingHeatmapVisible;
  if (btn) btn.classList.toggle('active', isCyclingHeatmapVisible);

  if (!plannerMap || !plannerMap.getSource('planner-heatmap-source')) return;

  if (!isCyclingHeatmapVisible) {
    plannerMap.getSource('planner-heatmap-source').setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  try {
    const res = await apiFetch('/api/activities/heatmap/tracks');
    const data = await res.json();
    const features = data?.geojson?.features || [];

    plannerMap.getSource('planner-heatmap-source').setData({
      type: 'FeatureCollection',
      features
    });
  } catch (err) {
    console.warn('Error cargando mapa de calor:', err);
  }
}

/**
 * 3) LA MEJOR HORA DE SALIDA SEGÚN VIENTO, TEMPERATURA Y HORAS DE LUZ (CON UN SOLO TOQUE)
 */
async function calculateBestDepartureHour() {
  if (plannerCoords.length < 2) {
    alert('Primero traza una ruta en el mapa o carga una ruta realizada para calcular su mejor hora de salida.');
    return;
  }

  const dateInput = document.getElementById('planner-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  const plannedDate = dateInput?.value || new Date().toISOString().slice(0, 10);
  const box = document.getElementById('planner-best-hours-box');
  const btn = document.getElementById('planner-best-hour-btn');
  if (!box) return;

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⚡ Analizando 24h…';
  }

  try {
    const metrics = getPlannerMetrics();
    const durationHours = Math.max(0.5, metrics.estimatedTimeSec / 3600);
    const startCoord = plannerCoords[0];
    const endCoord = plannerCoords[plannerCoords.length - 1];
    const mainBearing = (turf.bearing(turf.point(startCoord), turf.point(endCoord)) + 360) % 360;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${startCoord[1].toFixed(
      4
    )}&longitude=${startCoord[0].toFixed(
      4
    )}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,uv_index&daily=sunrise,sunset&start_date=${plannedDate}&end_date=${plannedDate}&timezone=auto`;

    const res = await fetch(url);
    const json = await res.json();

    const sunriseStr = json?.daily?.sunrise?.[0] || `${plannedDate}T07:45`;
    const sunsetStr = json?.daily?.sunset?.[0] || `${plannedDate}T18:15`;
    const sunriseHour = Math.max(6, new Date(sunriseStr).getHours());
    const sunsetHour = Math.min(21, new Date(sunsetStr).getHours());
    const sunsetClock = sunsetStr.slice(11, 16) || '18:15';

    const maxStartHour = Math.max(sunriseHour, Math.floor(sunsetHour - durationHours));
    const candidates = [];

    for (let h = sunriseHour; h <= maxStartHour; h++) {
      const temp = Math.round(json?.hourly?.temperature_2m?.[h] ?? 15);
      const rain = Math.round(json?.hourly?.precipitation_probability?.[h] ?? 10);
      const wind = Number((json?.hourly?.wind_speed_10m?.[h] ?? 12).toFixed(1));
      const windDir = json?.hourly?.wind_direction_10m?.[h] ?? 220;

      const angleRad = ((windDir - mainBearing) * Math.PI) / 180;
      const tailwind = Number((-wind * Math.cos(angleRad)).toFixed(1));

      // Puntuación (0 a 100): penaliza lluvia, viento fuerte o en contra y temperaturas lejos de 17°C
      let score = 100;
      score -= rain * 0.7;
      score -= Math.abs(temp - 17) * 1.8;
      score -= wind * 0.8;
      score += tailwind * 1.2;
      score = Math.max(15, Math.min(99, Math.round(score)));

      const hourStr = `${String(h).padStart(2, '0')}:00`;
      candidates.push({
        hourStr,
        score,
        temp,
        rain,
        wind,
        tailwind,
        sunsetClock
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top3 = candidates.slice(0, 3);

    box.style.display = 'flex';
    box.innerHTML = top3
      .map(
        (c, idx) => `
        <div class="best-hour-item ${idx === 0 ? 'top-pick' : ''}" data-hour="${c.hourStr}">
          <div class="bh-left">
            <span class="bh-time">${idx === 0 ? '🥇 Mejor salida:' : idx === 1 ? '🥈 Alternativa:' : '🥉 Opción:'} ${c.hourStr}</span>
            <span class="bh-meta">${c.temp}°C · 💧${c.rain}% · Viento ${c.wind} km/h · Luz hasta ${c.sunsetClock}</span>
          </div>
          <span class="bh-score">${c.score}/100</span>
        </div>
      `
      )
      .join('');

    box.querySelectorAll('.best-hour-item').forEach((item) => {
      item.addEventListener('click', () => {
        const timeInput = document.getElementById('planner-departure-time');
        if (timeInput) timeInput.value = item.dataset.hour;
        simulatePlannerRouteWeather();
      });
    });

    // Aplicar automáticamente la mejor hora (#1) y simular en el mapa
    if (top3[0]) {
      const timeInput = document.getElementById('planner-departure-time');
      if (timeInput) timeInput.value = top3[0].hourStr;
      await simulatePlannerRouteWeather();
    }
  } catch (err) {
    alert('Error calculando mejor hora de salida: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Mejor hora';
    }
  }
}

/**
 * 4) SINCRONIZACIÓN DE LOS 6 GRÁFICOS CON EL MAPA AL PASAR EL CURSOR
 */
function setupPlannerChartHoverSync() {
  const canvas = document.getElementById('planner-elevation-canvas');
  const readout = document.getElementById('planner-chart-hover-readout');
  if (!canvas) return;

  canvas.addEventListener('mousemove', (e) => {
    if (!plannerElevationProfile || plannerElevationProfile.length < 2 || plannerCoords.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const padL = 42;
    const padR = 12;
    const chartW = rect.width - padL - padR;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - padL) / Math.max(1, chartW)));

    const maxDist = plannerElevationProfile[plannerElevationProfile.length - 1].distance || 0.1;
    const targetKm = ratio * maxDist;

    drawPlannerElevationChart(targetKm);

    // Mover marcador sincronizado sobre la ruta en el mapa
    if (plannerMap) {
      const line = turf.lineString(plannerCoords.map((c) => [c[0], c[1]]));
      const pt = turf.along(line, Math.min(targetKm, turf.length(line, { units: 'kilometers' })), {
        units: 'kilometers'
      });

      if (!plannerHoverMarker) {
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.background = '#0ea5e9';
        el.style.border = '3px solid #ffffff';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
        plannerHoverMarker = new mapboxgl.Marker({ element: el });
      }
      plannerHoverMarker.setLngLat(pt.geometry.coordinates).addTo(plannerMap);
    }

    // Mostrar lectura sincronizada en vivo
    const elePt =
      plannerElevationProfile.find((p) => p.distance >= targetKm) ||
      plannerElevationProfile[plannerElevationProfile.length - 1];
    const wPt =
      plannerWeatherCheckpoints.find((c) => c.distKm >= targetKm) ||
      plannerWeatherCheckpoints[plannerWeatherCheckpoints.length - 1];

    if (readout && elePt) {
      const parts = [`Km ${targetKm.toFixed(2)}`, `${elePt.elevation}m (${elePt.grade > 0 ? '+' : ''}${elePt.grade}%)`];
      if (wPt) {
        parts.push(
          `${wPt.arrivalTimeStr}`,
          `${wPt.tempC}°C (Sens. ${wPt.apparentTempC ?? wPt.tempC}°C)`,
          `💨${wPt.windSpeedKmh}km/h · Rachas ${wPt.windGustsKmh ?? Math.round(wPt.windSpeedKmh * 1.4)}km/h (${wPt.windEffectLabel})`,
          `💧${wPt.rainProb}%`,
          `☁️${wPt.cloudCover ?? 20}%`,
          `Hum ${wPt.humidity ?? 55}%`,
          `UV ${wPt.uvIndex ?? 3}`
        );
      }
      readout.innerText = parts.join(' · ');
    }
  });

  canvas.addEventListener('mouseleave', () => {
    drawPlannerElevationChart(null);
    if (plannerHoverMarker) plannerHoverMarker.remove();
  });
}
function setupRoutePlanner() {
  setupSpainLocationSearch('planner-location-input', 'planner-location-results', () => plannerMap);
  setupSpainLocationSearch('seg-location-input', 'seg-location-results', () => segmentsMap);
  setupPlannerChartHoverSync();

  const colorModeSelect = document.getElementById('planner-color-mode');
  if (colorModeSelect) {
    colorModeSelect.addEventListener('change', (e) => {
      plannerRouteColorMode = e.target.value;
      repaintPlannerRouteSegmentsOnMap();
    });
  }

  const waterBtn = document.getElementById('planner-water-btn');
  if (waterBtn) {
    waterBtn.addEventListener('click', togglePlannerWaterSources);
  }

  const addWaterBtn = document.getElementById('planner-add-water-btn');
  if (addWaterBtn) {
    addWaterBtn.addEventListener('click', () => {
      isAddingWaterSourceMode = !isAddingWaterSourceMode;
      addWaterBtn.classList.toggle('active', isAddingWaterSourceMode);
      const statusEl = document.getElementById('planner-status-text');
      if (statusEl && isAddingWaterSourceMode) {
        statusEl.innerText = '💧 Haz clic en el punto exacto del mapa donde está la fuente de agua potable';
      }
    });
  }

  const heatmapBtn = document.getElementById('planner-heatmap-btn');
  if (heatmapBtn) {
    heatmapBtn.addEventListener('click', togglePlannerCyclingHeatmap);
  }

  const bestHourBtn = document.getElementById('planner-best-hour-btn');
  if (bestHourBtn) {
    bestHourBtn.addEventListener('click', calculateBestDepartureHour);
  }

  document.querySelectorAll('#planner-chart-tabs .p-chart-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#planner-chart-tabs .p-chart-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      plannerActiveChartType = tab.dataset.chart;
      drawPlannerElevationChart(null);
    });
  });
  const snapBtn = document.getElementById('planner-snap-btn');
  const snapText = document.getElementById('planner-snap-text');
  const loopBtn = document.getElementById('planner-loop-btn');
  const reverseBtn = document.getElementById('planner-reverse-btn');
  const undoBtn = document.getElementById('planner-undo-btn');
  const clearBtn = document.getElementById('planner-clear-btn');
  const toggle3DBtn = document.getElementById('planner-3d-btn');
  const toggle3DText = document.getElementById('planner-3d-text');
  const styleSelector = document.getElementById('planner-style-selector');
  const sportSelect = document.getElementById('planner-sport');
  const speedInput = document.getElementById('planner-speed');
  const baseActSelect = document.getElementById('planner-base-activity-select');
  const calcWeatherBtn = document.getElementById('planner-calc-weather-btn');
  const dateInput = document.getElementById('planner-date');
  const timeInput = document.getElementById('planner-departure-time');
  const exportGpxBtn = document.getElementById('planner-export-gpx-btn');
  const form = document.getElementById('planner-save-form');

  if (baseActSelect) {
    baseActSelect.addEventListener('change', (e) => {
      loadCompletedActivityIntoPlanner(e.target.value);
    });
  }

  const plannerGpxBtn = document.getElementById('planner-upload-gpx-btn');
  const plannerGpxInput = document.getElementById('planner-gpx-file-input');
  if (plannerGpxBtn && plannerGpxInput) {
    plannerGpxBtn.addEventListener('click', () => plannerGpxInput.click());
    plannerGpxInput.addEventListener('change', async () => {
      const file = plannerGpxInput.files?.[0];
      if (!file) return;
      try {
        const xmlText = await file.text();
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const trkpts = [...doc.getElementsByTagName('trkpt')];
        if (trkpts.length < 2) {
          alert('El archivo GPX no contiene suficientes puntos de ruta.');
          return;
        }
        const extracted = [];
        trkpts.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute('lat'));
          const lon = parseFloat(pt.getAttribute('lon'));
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            const eleEl = pt.getElementsByTagName('ele')[0];
            const ele = eleEl ? Math.round(parseFloat(eleEl.textContent) || 0) : 650;
            extracted.push([Number(lon.toFixed(6)), Number(lat.toFixed(6)), ele]);
          }
        });
        if (extracted.length < 2) return;

        clearPlannerWeatherOverlay();
        plannerBaseActivityId = null;
        activePlannedRouteId = null;
        plannerCoords = extracted;
        plannerWaypoints = [
          [extracted[0][0], extracted[0][1]],
          [extracted[extracted.length - 1][0], extracted[extracted.length - 1][1]]
        ];
        plannerWaypointsOnWay = [true, true];
        plannerLegs = [extracted];
        rebuildPlannerRouteAndElevation();

        const nameEl = doc.getElementsByTagName('name')[0];
        const cleanTitle = nameEl?.textContent?.trim() || file.name.replace(/\.[^/.]+$/, '');
        const titleInput = document.getElementById('planner-title');
        if (titleInput) titleInput.value = `${cleanTitle} (Planificada)`;

        updatePlannerMapDisplay();

        if (plannerMap && plannerCoords.length >= 2) {
          const bbox = turf.bbox({ type: 'Feature', geometry: { type: 'LineString', coordinates: plannerCoords } });
          plannerMap.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]]
            ],
            { padding: { top: 80, bottom: 190, left: 70, right: 70 }, maxZoom: 15, duration: 900 }
          );
        }

        await simulatePlannerRouteWeather();
      } catch (err) {
        alert('Error leyendo el archivo GPX: ' + err.message);
      } finally {
        plannerGpxInput.value = '';
      }
    });
  }

  if (calcWeatherBtn) {
    calcWeatherBtn.addEventListener('click', () => {
      simulatePlannerRouteWeather();
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (plannerCoords.length >= 2 && dateInput.value) {
        simulatePlannerRouteWeather();
      }
    });
  }

  if (timeInput) {
    timeInput.addEventListener('change', () => {
      if (plannerCoords.length >= 2 && dateInput?.value) {
        simulatePlannerRouteWeather();
      }
    });
  }

  if (snapBtn) {
    snapBtn.addEventListener('click', () => {
      isPlannerSnapEnabled = !isPlannerSnapEnabled;
      snapBtn.classList.toggle('active', isPlannerSnapEnabled);
      if (snapText) snapText.innerText = `Camino: ${isPlannerSnapEnabled ? 'Sí' : 'No'}`;
    });
  }

  if (loopBtn) {
    loopBtn.addEventListener('click', async () => {
      if (plannerWaypoints.length < 2) {
        alert('Añade al menos 2 puntos en el mapa antes de cerrar una ruta circular.');
        return;
      }
      const startCoord = [...plannerWaypoints[0]];
      const startWasOnWay = plannerWaypointsOnWay[0] ?? true;
      await addPlannerWaypoint(startCoord, startWasOnWay);
    });
  }

  if (reverseBtn) {
    reverseBtn.addEventListener('click', () => {
      if (plannerWaypoints.length < 2) return;
      plannerWaypoints.reverse();
      plannerWaypointsOnWay.reverse();
      plannerLegs = plannerLegs.map((leg) => [...leg].reverse()).reverse();
      rebuildPlannerRouteAndElevation();
      updatePlannerMapDisplay();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (plannerWaypoints.length > 0) {
        plannerWaypoints.pop();
        plannerWaypointsOnWay.pop();
        if (plannerLegs.length > 0) plannerLegs.pop();
        rebuildPlannerRouteAndElevation();
        updatePlannerMapDisplay();
      }
    });
  }

  if (clearBtn) clearBtn.addEventListener('click', clearPlannerRoute);

  if (toggle3DBtn) {
    toggle3DBtn.addEventListener('click', () => {
      isPlanner3D = !isPlanner3D;
      toggle3DBtn.classList.toggle('active', isPlanner3D);
      if (toggle3DText) toggle3DText.innerText = isPlanner3D ? '2D' : '3D';
      if (plannerMap) {
        if (isPlanner3D) {
          plannerMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          plannerMap.easeTo({ pitch: 65, bearing: 25, duration: 900 });
        } else {
          plannerMap.setTerrain({ source: 'mapbox-dem', exaggeration: 0.0001 });
          plannerMap.easeTo({ pitch: 0, bearing: 0, duration: 900 });
        }
      }
    });
  }

  if (styleSelector) {
    styleSelector.addEventListener('change', (e) => {
      if (plannerMap) plannerMap.setStyle(e.target.value);
    });
  }

  if (sportSelect && speedInput) {
    sportSelect.addEventListener('change', () => {
      if (sportSelect.value === 'MountainBikeRide') speedInput.value = 18;
      else if (sportSelect.value === 'GravelRide') speedInput.value = 22;
      else if (sportSelect.value === 'VirtualRide') speedInput.value = 34;
      else speedInput.value = 27;
      updatePlannerMapDisplay();
    });
    speedInput.addEventListener('input', () => {
      updatePlannerMapDisplay();
      if (plannerWeatherCheckpoints.length > 0) {
        simulatePlannerRouteWeather();
      }
    });
  }

  if (exportGpxBtn) {
    exportGpxBtn.addEventListener('click', () => {
      const title = document.getElementById('planner-title')?.value || 'Ruta Planificada Route3D';
      const sport = document.getElementById('planner-sport')?.value || 'Ride';
      exportCoordsAsGPXFile(title, sport, plannerCoords);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (plannerCoords.length < 2) {
        alert('Traza al menos 2 puntos en el mapa para diseñar la ruta antes de guardarla.');
        return;
      }

      const saveBtn = document.getElementById('planner-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Guardando…';
      }

      const metrics = getPlannerMetrics();
      const bikeVal = document.getElementById('planner-bike-select')?.value;
      const payload = {
        title: document.getElementById('planner-title').value,
        sportType: document.getElementById('planner-sport').value,
        bikeId: bikeVal && bikeVal !== '__custom__' ? bikeVal : null,
        notes: document.getElementById('planner-notes').value,
        targetSpeedKmh: parseFloat(document.getElementById('planner-speed').value) || 25,
        plannedDate: document.getElementById('planner-date')?.value || '',
        departureTime: document.getElementById('planner-departure-time')?.value || '09:00',
        sourceActivityId: plannerBaseActivityId || null,
        distanceMeters: metrics.distanceMeters,
        elevationGain: metrics.elevationGain,
        elevationLoss: metrics.elevationLoss,
        estimatedTimeSeconds: metrics.estimatedTimeSec,
        waypoints: plannerWaypoints,
        coordinates: plannerCoords,
        elevationProfile: plannerElevationProfile
      };

      try {
        const res = await apiFetch('/api/planned-routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.route) {
          activePlannedRouteId = data.route._id;
          await loadPlannedRoutes();
        } else {
          alert(data.error || 'Error guardando la ruta planificada');
        }
      } catch (err) {
        alert('Error guardando ruta: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Guardar ruta';
        }
      }
    });
  }
}

// ================= LISTA DE ACTIVIDADES =================
async function loadActivities() {
  const container = document.getElementById('activities-container');
  const countEl = document.getElementById('activities-count');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Cargando actividades…</p>
    </div>
  `;

  try {
    const [sortBy, sortOrder] = currentSort.split('-');
    const query = new URLSearchParams({
      type: activeSportFilter,
      gearId: activeGearFilter,
      dateFrom: activeDateFrom,
      dateTo: activeDateTo,
      search: searchQuery,
      sortBy,
      sortOrder,
      limit: '50'
    });

    const res = await apiFetch(`/api/activities?${query.toString()}`);
    const data = await res.json();

    if (!data.success || !data.activities || data.activities.length === 0) {
      if (countEl) countEl.innerText = '0 actividades encontradas';
      container.innerHTML = `
        <div class="empty-state">
          <p>No tienes rutas registradas con los filtros actuales.</p>
          <p style="font-size: 12.5px;">Usa el botón <strong>Subir GPX</strong> en la barra superior para añadir tu primera salida privada.</p>
        </div>
      `;
      return;
    }

    if (countEl) {
      const n = data.activities.length;
      countEl.innerText = `${n} ${n === 1 ? 'actividad registrada' : 'actividades registradas'}`;
    }

    populatePlannerBaseActivitiesDropdown(data.activities);

    container.innerHTML = data.activities
      .map((act) => {
        const badgeClass = getSportBadgeClass(act.type);
        const paceSpeed = formatPaceOrSpeed(act.averageSpeed, act.type);

        const tags = [
          act.averageWatts ? `<span class="card-tag">${act.averageWatts} W</span>` : null,
          act.averageCadence ? `<span class="card-tag">${act.averageCadence} rpm</span>` : null,
          act.averageHeartrate ? `<span class="card-tag">${act.averageHeartrate} bpm</span>` : null,
          act.calories ? `<span class="card-tag">${act.calories} kcal</span>` : null,
          act.gear ? `<span class="card-tag gear-pill">${ICONS.bikeSmall} ${act.gear}</span>` : null
        ].filter(Boolean);

        return `
          <article class="activity-card" data-id="${act._id}">
            <div>
              <div class="activity-card-top">
                <div class="activity-meta-left">
                  <span class="sport-badge ${badgeClass}">${getSportName(act.type)}</span>
                  <span class="activity-date">${formatDate(act.startDate)}</span>
                </div>
                <div class="card-quick-actions">
                  <button class="btn-icon-only edit-act-btn" data-id="${act._id}" type="button" title="Editar" aria-label="Editar">
                    ${ICONS.edit}
                  </button>
                  <button class="btn-icon-only danger delete-act-btn" data-id="${act._id}" type="button" title="Eliminar" aria-label="Eliminar">
                    ${ICONS.trash}
                  </button>
                </div>
              </div>
              <h3 class="activity-title" style="margin-top: 8px;">${act.title}</h3>
            </div>

            <div class="card-metrics-grid">
              <div class="metric-item">
                <span class="metric-label">Distancia</span>
                <span class="metric-val">${formatDistance(act.distance)} <small>km</small></span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Vel. Media</span>
                <span class="metric-val">${paceSpeed}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Desnivel</span>
                <span class="metric-val accent">+${act.totalElevationGain || 0} <small>m</small></span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Tiempo</span>
                <span class="metric-val">${formatDuration(act.movingTime)}</span>
              </div>
            </div>

            <div class="activity-card-footer">
              <div class="card-tags">
                ${tags.join('')}
              </div>
              <span class="card-open-hint">Ver ruta ${ICONS.arrowRight}</span>
            </div>
          </article>
        `;
      })
      .join('');

    container.querySelectorAll('.activity-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-act-btn') || e.target.closest('.delete-act-btn')) {
          return;
        }
        loadActivityIntoViewer(card.dataset.id);
      });
    });

    container.querySelectorAll('.delete-act-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteActivity(btn.dataset.id);
      });
    });

    container.querySelectorAll('.edit-act-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });
  } catch (err) {
    console.error('Error cargando actividades:', err);
    container.innerHTML = `<div class="empty-state">Error conectando con el servidor backend.</div>`;
  }
}

// ================= ELIMINAR Y EDITAR =================
async function deleteActivity(id) {
  if (!confirm('¿Eliminar esta actividad de forma permanente?')) return;
  try {
    const res = await apiFetch(`/api/activities/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadActivities();
      loadStatsSummary();
      loadGear();
    }
  } catch (err) {
    alert('Error al eliminar la actividad: ' + err.message);
  }
}

async function openEditModal(id) {
  try {
    const res = await apiFetch(`/api/activities/${id}`);
    const data = await res.json();
    if (!data.success) return;

    const act = data.activity;
    document.getElementById('edit-id').value = act._id;
    document.getElementById('edit-title').value = act.title;
    document.getElementById('edit-type').value = act.type;
    document.getElementById('edit-desc').value = act.description || '';

    const editGearSelect = document.getElementById('edit-gear-select');
    const editGearInput = document.getElementById('edit-gear');
    populateGearSelect(editGearSelect);

    const matchedGear = gearList.find(
      (g) => (act.gearId && String(g._id) === String(act.gearId)) || (act.gear && g.name.toLowerCase() === act.gear.toLowerCase())
    );

    if (matchedGear) {
      editGearSelect.value = matchedGear._id;
      editGearInput.style.display = 'none';
      editGearInput.value = matchedGear.name;
    } else if (act.gear) {
      editGearSelect.value = '__custom__';
      editGearInput.style.display = 'block';
      editGearInput.value = act.gear;
    } else {
      editGearSelect.value = '';
      editGearInput.style.display = 'none';
      editGearInput.value = '';
    }

    document.getElementById('edit-modal').style.display = 'flex';
  } catch (err) {
    console.error(err);
  }
}

// ================= MÓDULO DE EQUIPOS Y BICICLETAS =================
function getBikeTypeName(bikeType) {
  switch (bikeType) {
    case 'Road': return 'Bici Carretera';
    case 'MTB': return 'Bici MTB';
    case 'Gravel': return 'Bici Gravel';
    case 'TT': return 'Cabra / TT';
    default: return 'Bicicleta';
  }
}

function populateGearSelect(selectEl) {
  if (!selectEl) return;
  const bikes = gearList.filter((g) => !g.retired);

  let html = `<option value="">Sin especificar</option>`;
  if (bikes.length > 0) {
    html += bikes
      .map(
        (b) =>
          `<option value="${b._id}">${b.isDefault ? '★ ' : ''}${b.name} (${getBikeTypeName(b.bikeType)})${b.isDefault ? ' — Favorita' : ''}</option>`
      )
      .join('');
  }
  html += `<option value="__custom__">+ Escribir otra bicicleta manualmente…</option>`;
  selectEl.innerHTML = html;
}

function getDefaultSportForBike(bike) {
  if (!bike) return 'Ride';
  if (bike.bikeType === 'MTB') return 'MountainBikeRide';
  if (bike.bikeType === 'Gravel') return 'GravelRide';
  if (bike.bikeType === 'TT') return 'VirtualRide';
  return 'Ride';
}

function applyFavoriteGearToUploadForm() {
  const selectEl = document.getElementById('act-gear-select');
  const customInputEl = document.getElementById('act-gear');
  const actTypeEl = document.getElementById('act-type');
  if (!selectEl || gearList.length === 0) return;

  populateGearSelect(selectEl);
  if (customInputEl) {
    customInputEl.style.display = 'none';
    customInputEl.value = '';
  }

  const bikes = gearList.filter((g) => !g.retired);
  const favoriteBike = bikes.find((b) => b.isDefault) || bikes[0];

  if (favoriteBike) {
    selectEl.value = favoriteBike._id;
    if (actTypeEl) {
      actTypeEl.value = getDefaultSportForBike(favoriteBike);
    }
  }
}

function selectRecommendedGearForSport(sportType, selectEl, customInputEl) {
  if (!selectEl || gearList.length === 0) return;
  if (customInputEl) customInputEl.style.display = 'none';

  const bikes = gearList.filter((g) => !g.retired);
  const favoriteBike = bikes.find((b) => b.isDefault) || bikes[0];
  selectEl.value = favoriteBike ? favoriteBike._id : '';
}

function updateActivityGearFilterDropdown() {
  const filterSelect = document.getElementById('activity-gear-filter');
  if (!filterSelect) return;

  const currentVal = activeGearFilter;
  let html = `<option value="all">Todas las bicicletas</option>`;
  html += gearList.map((b) => `<option value="${b._id}">${b.isDefault ? '★ ' : ''}${b.name}</option>`).join('');

  filterSelect.innerHTML = html;
  if ([...filterSelect.options].some((o) => o.value === currentVal)) {
    filterSelect.value = currentVal;
  } else {
    filterSelect.value = 'all';
    activeGearFilter = 'all';
  }
}

async function loadGear() {
  const container = document.getElementById('gear-container');
  const subtitle = document.getElementById('gear-summary-subtitle');

  try {
    const res = await apiFetch('/api/gear');
    const data = await res.json();
    if (!data.success) return;

    gearList = data.gear || [];
    updateActivityGearFilterDropdown();
    populateGearSelect(document.getElementById('act-gear-select'));
    populateGearSelect(document.getElementById('edit-gear-select'));
    populateGearSelect(document.getElementById('planner-bike-select'));
    const favBike = gearList.find((g) => g.isDefault && !g.retired) || gearList[0];
    const plannerBikeSelect = document.getElementById('planner-bike-select');
    if (plannerBikeSelect && favBike) {
      plannerBikeSelect.value = favBike._id;
    }

    const actType = document.getElementById('act-type');
    if (actType) {
      selectRecommendedGearForSport(
        actType.value,
        document.getElementById('act-gear-select'),
        document.getElementById('act-gear')
      );
    }

    if (subtitle) {
      const bikes = gearList.filter((g) => g.category === 'bike');
      const totalBikeKm = bikes.reduce((sum, b) => sum + (b.stats?.totalDistanceKm || 0), 0);
      subtitle.innerText = `${bikes.length} ${bikes.length === 1 ? 'bicicleta registrada' : 'bicicletas registradas'} · ${totalBikeKm.toFixed(1)} km acumulados en bici`;
    }

    renderGearCards();
    syncLabWithUserAndGarage();
  } catch (err) {
    console.error('Error cargando equipos:', err);
    if (container) {
      container.innerHTML = `<div class="empty-state">Error cargando bicicletas y equipos.</div>`;
    }
  }
}

function getMaintenanceTypeLabel(type) {
  switch (type) {
    case 'drivetrain': return 'Cadena / Transmisión';
    case 'suspension': return 'Suspensiones / SAG';
    case 'tires': return 'Tubeless / Cubiertas';
    case 'brakes': return 'Frenos';
    case 'upgrade': return 'Modificación';
    case 'general': return 'Revisión general';
    default: return 'Mantenimiento';
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function renderGearCards() {
  const container = document.getElementById('gear-container');
  if (!container) return;

  const filtered =
    activeGearCategoryFilter === 'all'
      ? gearList
      : gearList.filter((g) => g.bikeType === activeGearCategoryFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No tienes bicicletas registradas en esta modalidad.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((g) => {
      const stats = g.stats || {
        activitiesCount: 0,
        totalDistanceKm: g.initialDistanceKm || 0,
        totalElevationGain: 0,
        totalMovingHours: 0,
        kmSinceLastService: g.initialDistanceKm || 0
      };
      const icon = g.category === 'shoes' ? ICONS.shoe : ICONS.bike;
      const typeLabel = getBikeTypeName(g.bikeType, g.category);
      const subParts = [g.brand, g.model, g.weightKg ? `${g.weightKg} kg` : null].filter(Boolean);

      // Bloque de Suspensiones y SAG (Horquilla y Amortiguador)
      const susp = g.suspension || {};
      const hasFork = susp.forkModel || susp.forkSag !== null && susp.forkSag !== undefined || susp.forkPsi;
      const hasShock = susp.shockModel || susp.shockSag !== null && susp.shockSag !== undefined || susp.shockPsi;
      let suspensionHtml = '';

      if (g.category === 'bike' && (hasFork || hasShock)) {
        const forkSpecs = [
          susp.forkPsi ? `${susp.forkPsi} PSI` : null,
          susp.forkRebound ? `Rebote ${susp.forkRebound}` : null
        ].filter(Boolean);

        const shockSpecs = [
          susp.shockPsi ? `${susp.shockPsi} PSI` : null,
          susp.shockRebound ? `Rebote ${susp.shockRebound}` : null
        ].filter(Boolean);

        suspensionHtml = `
          <div class="gear-suspension-grid">
            <div class="suspension-pill-card">
              <div class="suspension-pill-top">
                <span class="suspension-pill-title">Horquilla</span>
                <span class="sag-badge">SAG ${susp.forkSag ?? '--'}%</span>
              </div>
              <span class="suspension-pill-model">${susp.forkModel || 'Horquilla delantera'}</span>
              <span class="suspension-pill-specs">${forkSpecs.join(' · ') || 'Sin presión indicada'}</span>
            </div>

            <div class="suspension-pill-card">
              <div class="suspension-pill-top">
                <span class="suspension-pill-title">Amortiguador</span>
                <span class="sag-badge">SAG ${susp.shockSag ?? '--'}%</span>
              </div>
              <span class="suspension-pill-model">${susp.shockModel || 'Amortiguador trasero'}</span>
              <span class="suspension-pill-specs">${shockSpecs.join(' · ') || 'Sin presión indicada'}</span>
            </div>
          </div>
        `;
      }

      // Barra de intervalo de revisión
      let wearHtml = '';
      if (g.maxDistanceKm && g.maxDistanceKm > 0) {
        const kmUsed = stats.kmSinceLastService ?? stats.totalDistanceKm;
        const pct = Math.min(100, Math.round((kmUsed / g.maxDistanceKm) * 100));
        wearHtml = `
          <div class="gear-wear-box">
            <div class="gear-wear-meta">
              <span>Km desde última revisión</span>
              <span>${kmUsed} / ${g.maxDistanceKm} km (${pct}%)</span>
            </div>
            <div class="gear-wear-track">
              <div class="gear-wear-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }

      // Historial de Revisiones y Modificaciones (sección principal dentro del equipo)
      const logs = g.maintenanceLogs || [];
      const lastLog = logs[0];
      const logsHtml =
        logs.length === 0
          ? `<p class="maint-empty">Aún no hay revisiones registradas (cadena, aire de amortiguadores, tubeless…).</p>`
          : `
            <div class="maint-log-list">
              ${logs
                .map((log) => {
                  const sagUpdates = [
                    log.forkSag !== null && log.forkSag !== undefined ? `Horquilla: SAG ${log.forkSag}%` : null,
                    log.forkPsi ? `${log.forkPsi} PSI` : null,
                    log.shockSag !== null && log.shockSag !== undefined ? `Amortiguador: SAG ${log.shockSag}%` : null,
                    log.shockPsi ? `${log.shockPsi} PSI` : null
                  ].filter(Boolean);

                  return `
                    <div class="maint-log-item">
                      <div class="maint-log-top">
                        <div class="maint-log-meta">
                          <span class="maint-type-tag ${log.type || 'general'}">${getMaintenanceTypeLabel(log.type)}</span>
                          <span class="maint-log-date">${formatShortDate(log.date)} · ${log.odometerKm || 0} km</span>
                        </div>
                        <button
                          class="btn-icon-only danger delete-maint-btn"
                          data-gear-id="${g._id}"
                          data-log-id="${log._id}"
                          type="button"
                          title="Eliminar revisión"
                        >
                          ${ICONS.trash}
                        </button>
                      </div>
                      <div class="maint-log-title">${log.title}</div>
                      ${log.details ? `<p class="maint-log-details">${log.details}</p>` : ''}
                      ${sagUpdates.length > 0 ? `<div class="maint-log-sag-row">${sagUpdates.join(' · ')}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
          `;

      return `
        <article class="gear-card ${g.isDefault ? 'is-default' : ''}" data-id="${g._id}">
          <div class="gear-card-header">
            <div class="gear-identity">
              <div class="gear-icon-box">${icon}</div>
              <div class="gear-title-group">
                <div class="gear-badges-row">
                  <span class="gear-type-badge">${typeLabel}</span>
                </div>
                <h3 class="gear-name">${g.name}</h3>
                ${subParts.length > 0 ? `<span class="gear-submeta">${subParts.join(' · ')}</span>` : ''}
              </div>
            </div>

            <div class="card-quick-actions" style="opacity: 1; gap: 6px;">
              ${
                g.isDefault
                  ? `<span class="fav-bike-btn is-fav" title="Esta bicicleta se selecciona siempre por defecto al subir una ruta">★ Favorita</span>`
                  : `<button class="fav-bike-btn default-gear-btn" data-id="${g._id}" type="button" title="Marcar como favorita por defecto al subir rutas">☆ Hacer favorita</button>`
              }
              <button class="btn-icon-only edit-gear-btn" data-id="${g._id}" type="button" title="Editar bicicleta y SAG">${ICONS.edit}</button>
              <button class="btn-icon-only danger delete-gear-btn" data-id="${g._id}" type="button" title="Eliminar">${ICONS.trash}</button>
            </div>
          </div>

          <div class="card-metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Distancia</span>
              <span class="metric-val">${stats.totalDistanceKm} <small>km</small></span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Desnivel</span>
              <span class="metric-val accent">+${stats.totalElevationGain} <small>m</small></span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Tiempo</span>
              <span class="metric-val">${stats.totalMovingHours} <small>h</small></span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Salidas</span>
              <span class="metric-val">${stats.activitiesCount}</span>
            </div>
          </div>

          ${
            g.notes
              ? `<div class="gear-components-row">
                  <span class="gear-section-micro-label">Montaje y componentes</span>
                  <p class="gear-notes-clean">${g.notes}</p>
                </div>`
              : ''
          }
          ${suspensionHtml}

          <!-- SECCIÓN IMPORTANTE: REVISIONES Y MODIFICACIONES -->
          <div class="gear-maintenance-section">
            <div class="gear-maint-header">
              <div class="gear-maint-title-group">
                <span class="gear-maint-title">Revisiones y Modificaciones (${logs.length})</span>
                <span class="gear-maint-sub">
                  ${
                    lastLog
                      ? `Última revisión: ${formatShortDate(lastLog.date)} a los ${lastLog.odometerKm} km`
                      : 'Sin revisiones registradas'
                  }
                </span>
              </div>
              <button class="btn btn-secondary btn-xs add-maint-btn" data-id="${g._id}" type="button">
                + Registrar revisión
              </button>
            </div>

            ${wearHtml}
            ${logsHtml}
          </div>

          <div class="gear-card-footer">
            <span style="font-size: 12px; color: var(--text-muted);">
              ${g.initialDistanceKm ? `Incluye ${g.initialDistanceKm} km previos` : 'Desde 0 km'}
            </span>
            <button class="btn-link-filter filter-by-gear-btn" data-id="${g._id}" type="button">
              Ver rutas con esta bici (${stats.activitiesCount}) ${ICONS.arrowRight}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.edit-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => openGearModal(btn.dataset.id));
  });

  container.querySelectorAll('.delete-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteGear(btn.dataset.id));
  });

  container.querySelectorAll('.default-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => setGearAsDefault(btn.dataset.id));
  });

  container.querySelectorAll('.add-maint-btn').forEach((btn) => {
    btn.addEventListener('click', () => openMaintenanceModal(btn.dataset.id));
  });

  container.querySelectorAll('.delete-maint-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteMaintenanceLog(btn.dataset.gearId, btn.dataset.logId));
  });

  container.querySelectorAll('.filter-by-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeGearFilter = btn.dataset.id;
      const filterSelect = document.getElementById('activity-gear-filter');
      if (filterSelect) filterSelect.value = activeGearFilter;
      switchTab('activities');
      loadActivities();
    });
  });
}

function openGearModal(gearId = null) {
  const modal = document.getElementById('gear-modal');
  const titleEl = document.getElementById('gear-modal-title');
  const form = document.getElementById('gear-form');
  const bikeTypeGroup = document.getElementById('gear-biketype-group');
  const suspensionSection = document.getElementById('gear-suspension-section');
  if (!modal || !form) return;

  form.reset();

  if (gearId) {
    const g = gearList.find((item) => String(item._id) === String(gearId));
    if (!g) return;
    if (titleEl) titleEl.innerText = 'Editar bicicleta';
    document.getElementById('gear-id').value = g._id;
    document.getElementById('gear-category').value = 'bike';
    document.getElementById('gear-biketype').value = g.bikeType || 'Road';
    document.getElementById('gear-name').value = g.name || '';
    document.getElementById('gear-brand').value = g.brand || '';
    document.getElementById('gear-model').value = g.model || '';
    document.getElementById('gear-weight').value = g.weightKg ?? '';
    document.getElementById('gear-initial-km').value = g.initialDistanceKm || 0;
    document.getElementById('gear-max-km').value = g.maxDistanceKm ?? '';
    document.getElementById('gear-notes').value = g.notes || '';
    document.getElementById('gear-default').checked = Boolean(g.isDefault);

    const susp = g.suspension || {};
    document.getElementById('gear-fork-model').value = susp.forkModel || '';
    document.getElementById('gear-fork-sag').value = susp.forkSag ?? '';
    document.getElementById('gear-fork-psi').value = susp.forkPsi ?? '';
    document.getElementById('gear-fork-rebound').value = susp.forkRebound || '';
    document.getElementById('gear-shock-model').value = susp.shockModel || '';
    document.getElementById('gear-shock-sag').value = susp.shockSag ?? '';
    document.getElementById('gear-shock-psi').value = susp.shockPsi ?? '';
    document.getElementById('gear-shock-rebound').value = susp.shockRebound || '';
  } else {
    if (titleEl) titleEl.innerText = 'Añadir bicicleta';
    document.getElementById('gear-id').value = '';
    document.getElementById('gear-category').value = 'bike';
    document.getElementById('gear-biketype').value = 'Road';
    document.getElementById('gear-initial-km').value = 0;
  }

  modal.style.display = 'flex';
}

function openMaintenanceModal(gearId) {
  const modal = document.getElementById('maintenance-modal');
  const form = document.getElementById('maintenance-form');
  const subtitle = document.getElementById('maintenance-bike-subtitle');
  if (!modal || !form) return;

  const g = gearList.find((item) => String(item._id) === String(gearId));
  if (!g) return;

  form.reset();
  document.getElementById('maint-gear-id').value = g._id;
  document.getElementById('maint-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('maint-km').value = Math.round(g.stats?.totalDistanceKm || g.initialDistanceKm || 0);

  const susp = g.suspension || {};
  document.getElementById('maint-fork-sag').value = susp.forkSag ?? '';
  document.getElementById('maint-fork-psi').value = susp.forkPsi ?? '';
  document.getElementById('maint-shock-sag').value = susp.shockSag ?? '';
  document.getElementById('maint-shock-psi').value = susp.shockPsi ?? '';

  if (subtitle) {
    subtitle.innerText = `${g.name} · ${g.stats?.totalDistanceKm || 0} km actuales`;
  }

  modal.style.display = 'flex';
}

async function deleteMaintenanceLog(gearId, logId) {
  if (!confirm('¿Eliminar este registro de revisión?')) return;
  try {
    const res = await apiFetch(`/api/gear/${gearId}/maintenance/${logId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await loadGear();
    }
  } catch (err) {
    alert('Error eliminando revisión: ' + err.message);
  }
}

function setupMaintenanceModal() {
  const modal = document.getElementById('maintenance-modal');
  const closeBtn = document.getElementById('close-maintenance-modal');
  const cancelBtn = document.getElementById('cancel-maintenance-btn');
  const form = document.getElementById('maintenance-form');
  if (!modal) return;

  const closeModal = () => {
    modal.style.display = 'none';
  };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gearId = document.getElementById('maint-gear-id').value;
      const payload = {
        date: document.getElementById('maint-date').value,
        odometerKm: document.getElementById('maint-km').value,
        type: document.getElementById('maint-type').value,
        title: document.getElementById('maint-title').value,
        details: document.getElementById('maint-details').value,
        forkSag: document.getElementById('maint-fork-sag').value,
        forkPsi: document.getElementById('maint-fork-psi').value,
        shockSag: document.getElementById('maint-shock-sag').value,
        shockPsi: document.getElementById('maint-shock-psi').value
      };

      try {
        const res = await apiFetch(`/api/gear/${gearId}/maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          closeModal();
          await loadGear();
        } else {
          alert('Error guardando revisión: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        alert('Error guardando revisión: ' + err.message);
      }
    });
  }
}

async function setGearAsDefault(id) {
  try {
    await apiFetch(`/api/gear/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true })
    });
    await loadGear();
  } catch (err) {
    console.error('Error marcando equipo principal:', err);
  }
}

async function deleteGear(id) {
  if (!confirm('¿Eliminar esta bicicleta / equipo? Tus actividades se conservarán.')) return;
  try {
    const res = await apiFetch(`/api/gear/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      if (activeGearFilter === id) activeGearFilter = 'all';
      await loadGear();
      await loadActivities();
    }
  } catch (err) {
    alert('Error eliminando equipo: ' + err.message);
  }
}

function setupGearModal() {
  const modal = document.getElementById('gear-modal');
  const openBtn = document.getElementById('open-gear-modal-btn');
  const closeBtn = document.getElementById('close-gear-modal');
  const cancelBtn = document.getElementById('cancel-gear-btn');
  const categorySelect = document.getElementById('gear-category');
  const bikeTypeGroup = document.getElementById('gear-biketype-group');
  const suspensionSection = document.getElementById('gear-suspension-section');
  const form = document.getElementById('gear-form');

  if (!modal) return;

  const closeModal = () => {
    modal.style.display = 'none';
  };
  if (openBtn) openBtn.addEventListener('click', () => openGearModal(null));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      const isBike = categorySelect.value === 'bike';
      if (bikeTypeGroup) bikeTypeGroup.style.display = isBike ? 'flex' : 'none';
      if (suspensionSection) suspensionSection.style.display = isBike ? 'flex' : 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('gear-id').value;
      const payload = {
        name: document.getElementById('gear-name').value,
        category: document.getElementById('gear-category').value,
        bikeType: document.getElementById('gear-biketype').value,
        brand: document.getElementById('gear-brand').value,
        model: document.getElementById('gear-model').value,
        weightKg: document.getElementById('gear-weight').value,
        initialDistanceKm: document.getElementById('gear-initial-km').value,
        maxDistanceKm: document.getElementById('gear-max-km').value,
        notes: document.getElementById('gear-notes').value,
        isDefault: document.getElementById('gear-default').checked,
        suspension: {
          forkModel: document.getElementById('gear-fork-model').value,
          forkSag: document.getElementById('gear-fork-sag').value,
          forkPsi: document.getElementById('gear-fork-psi').value,
          forkRebound: document.getElementById('gear-fork-rebound').value,
          shockModel: document.getElementById('gear-shock-model').value,
          shockSag: document.getElementById('gear-shock-sag').value,
          shockPsi: document.getElementById('gear-shock-psi').value,
          shockRebound: document.getElementById('gear-shock-rebound').value
        }
      };

      try {
        const res = await apiFetch(id ? `/api/gear/${id}` : '/api/gear', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          closeModal();
          await loadGear();
          await loadActivities();
        } else {
          alert('Error guardando equipo: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        alert('Error guardando equipo: ' + err.message);
      }
    });
  }
}

// ================= ESTADÍSTICAS GLOBALES =================
async function loadStatsSummary() {
  try {
    const res = await apiFetch('/api/activities/stats/summary');
    const data = await res.json();
    if (!data.success || !data.stats) return;

    const s = data.stats;
    document.getElementById('kpi-distance').innerHTML = `${s.totalDistanceKm} <small>km</small>`;
    document.getElementById('kpi-hours').innerHTML = `${s.totalMovingHours} <small>h</small>`;
    document.getElementById('kpi-elevation').innerHTML = `+${s.totalElevationGain} <small>m</small>`;
    document.getElementById('kpi-calories').innerHTML = `${s.totalCalories} <small>kcal</small>`;

    if (s.records) {
      document.getElementById('rec-longest').innerText = `${s.records.longestDistanceKm} km`;
      document.getElementById('rec-climb').innerText = `+${s.records.highestClimbMeters} m`;
      document.getElementById('rec-speed').innerText = `${s.records.maxSpeedKmh} km/h`;
    }

    const breakdown = document.getElementById('sports-breakdown');
    if (breakdown && s.bySport) {
      const entries = Object.entries(s.bySport);
      if (entries.length === 0) {
        breakdown.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Sin datos todavía.</p>`;
      } else {
        breakdown.innerHTML = entries
          .map(
            ([sport, info]) => `
            <div class="sport-summary-row">
              <div class="sport-row-left">
                <span class="sport-badge ${getSportBadgeClass(sport)}">${getSportName(sport)}</span>
                <span class="sport-row-count">${info.count} ${info.count === 1 ? 'sesión' : 'sesiones'}</span>
              </div>
              <div class="sport-row-metrics">
                <span>${(info.distance / 1000).toFixed(1)} km</span>
                <span class="sport-row-ele">+${Math.round(info.elevation)} m</span>
              </div>
            </div>
          `
          )
          .join('');
      }
    }
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// ================= SALUD DEL BACKEND =================
async function checkBackendHealth() {
  const badge = document.getElementById('db-status-badge');
  const dot = badge?.querySelector('.status-dot');
  const text = document.getElementById('db-status-text');

  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok' && data.database === 'connected') {
      if (dot) dot.className = 'status-dot connected';
      if (text) text.innerText = 'En línea';
    } else {
      throw new Error('Database not connected');
    }
  } catch {
    if (dot) dot.className = 'status-dot error';
    if (text) text.innerText = 'Sin conexión';
  }
}

// ================= TABS (PROTEGIDAS POR SESIÓN) =================
function switchTab(tabName) {
  if (!currentUser || !getAuthToken()) {
    showAuthScreen(true);
    return;
  }

  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-pane').forEach((p) => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });

  if (tabName === 'viewer') {
    setTimeout(() => {
      if (map) map.resize();
      if (currentActivity) {
        drawElevationProfile(currentActivity.elevationProfile || [], currentDistanceKm);
      }
    }, 80);
  } else if (tabName === 'segments') {
    setTimeout(() => {
      initSegmentsZoneMap();
      if (segmentsMap) segmentsMap.resize();
      loadAllSegmentsForZone();
    }, 60);
  } else if (tabName === 'planner') {
    setTimeout(() => {
      initPlannerMap();
      if (plannerMap) plannerMap.resize();
      drawPlannerElevationChart();
      loadPlannedRoutes();
    }, 60);
  } else if (tabName === 'lab') {
    setTimeout(() => {
      syncLabWithUserAndGarage();
      calculateTirePressureLab();
    }, 60);
  }
}

// ================= CALCULADORA DE PRESIÓN DE NEUMÁTICOS (CARRETERA, GRAVEL Y MTB) =================
function syncLabWithUserAndGarage() {
  const riderWeightInput = document.getElementById('tp-rider-weight');
  if (riderWeightInput && currentUser && currentUser.weightKg) {
    riderWeightInput.value = currentUser.weightKg;
  }

  const bikeSelect = document.getElementById('tp-bike-select');
  if (!bikeSelect) return;

  const currentVal = bikeSelect.value;
  const bikes = gearList.filter((g) => !g.retired);
  let html = `<option value="">— Selección manual —</option>`;
  html += bikes
    .map(
      (b) =>
        `<option value="${b._id}">${b.isDefault ? '★ ' : ''}${b.name} (${getBikeTypeName(b.bikeType)}${
          b.weightKg ? ` · ${b.weightKg} kg` : ''
        })</option>`
    )
    .join('');
  bikeSelect.innerHTML = html;

  if (currentVal && bikes.some((b) => String(b._id) === String(currentVal))) {
    bikeSelect.value = currentVal;
  } else {
    const fav = bikes.find((b) => b.isDefault) || bikes[0];
    if (fav) {
      bikeSelect.value = fav._id;
      applyBikePresetsToPressureLab(fav);
    }
  }
}

function applyBikePresetsToPressureLab(bike) {
  if (!bike) return;
  const discEl = document.getElementById('tp-discipline');
  const bikeWeightEl = document.getElementById('tp-bike-weight');
  const tireFrontEl = document.getElementById('tp-tire-width');
  const tireRearEl = document.getElementById('tp-tire-width-rear');
  const rimEl = document.getElementById('tp-rim-width');
  const surfaceEl = document.getElementById('tp-surface');
  const setupEl = document.getElementById('tp-setup');

  if (bikeWeightEl && bike.weightKg) {
    bikeWeightEl.value = bike.weightKg;
  }
  const bType = bike.bikeType || 'Road';
  if (discEl && ['Road', 'Gravel', 'MTB', 'TT'].includes(bType)) {
    discEl.value = bType;
  }

  if (bType === 'MTB') {
    if (tireFrontEl) tireFrontEl.value = 58; // 2.30"
    if (tireRearEl) tireRearEl.value = 57; // 2.25"
    if (rimEl) rimEl.value = 30;
    if (surfaceEl) surfaceEl.value = 'mtb_dry';
    if (setupEl) setupEl.value = 'tubeless';
  } else if (bType === 'Gravel') {
    if (tireFrontEl) tireFrontEl.value = 42;
    if (tireRearEl) tireRearEl.value = 42;
    if (rimEl) rimEl.value = 24;
    if (surfaceEl) surfaceEl.value = 'gravel_fast';
    if (setupEl) setupEl.value = 'tubeless';
  } else if (bType === 'TT') {
    if (tireFrontEl) tireFrontEl.value = 26;
    if (tireRearEl) tireRearEl.value = 28;
    if (rimEl) rimEl.value = 21;
    if (surfaceEl) surfaceEl.value = 'smooth_dry';
    if (setupEl) setupEl.value = 'tpu';
  } else {
    if (tireFrontEl) tireFrontEl.value = 28;
    if (tireRearEl) tireRearEl.value = 28;
    if (rimEl) rimEl.value = 21;
    if (surfaceEl) surfaceEl.value = 'smooth_dry';
    if (setupEl) setupEl.value = 'tubeless';
  }
}

function calculateTirePressureLab() {
  const riderKg = Math.max(35, parseFloat(document.getElementById('tp-rider-weight')?.value) || 72);
  const bikeKg = Math.max(4, parseFloat(document.getElementById('tp-bike-weight')?.value) || 8.2);
  const totalKg = Number((riderKg + bikeKg).toFixed(1));
  const discipline = document.getElementById('tp-discipline')?.value || 'Road';
  const wheelSize = document.getElementById('tp-wheel-size')?.value || '700c';
  const tireFrontMm = Math.max(20, parseFloat(document.getElementById('tp-tire-width')?.value) || 28);
  const tireRearMm = Math.max(20, parseFloat(document.getElementById('tp-tire-width-rear')?.value) || tireFrontMm);
  const rimMm = Math.max(13, parseFloat(document.getElementById('tp-rim-width')?.value) || 21);
  const setup = document.getElementById('tp-setup')?.value || 'tubeless';
  const casing = document.getElementById('tp-casing')?.value || 'standard';
  const surface = document.getElementById('tp-surface')?.value || 'smooth_dry';
  const feel = document.getElementById('tp-feel')?.value || 'balanced';
  const insert = document.getElementById('tp-insert')?.value || 'none';

  // Reparto de masas delantero / trasero según geometría de disciplina
  let frontRatio = 0.46;
  if (discipline === 'MTB') frontRatio = 0.44;
  else if (discipline === 'Gravel') frontRatio = 0.45;
  else if (discipline === 'TT') frontRatio = 0.48;
  const rearRatio = Number((1 - frontRatio).toFixed(2));

  const frontLoadKg = Number((totalKg * frontRatio).toFixed(1));
  const rearLoadKg = Number((totalKg * rearRatio).toFixed(1));

  // Anchura efectiva del neumático según ancho interno de llanta (+0.4 mm de balón por cada mm extra sobre llanta de referencia)
  const refRimFront = tireFrontMm >= 50 ? 27 : tireFrontMm >= 35 ? 23 : 19;
  const refRimRear = tireRearMm >= 50 ? 27 : tireRearMm >= 35 ? 23 : 19;
  const effFrontMm = Math.max(20, tireFrontMm + (rimMm - refRimFront) * 0.38);
  const effRearMm = Math.max(20, tireRearMm + (rimMm - refRimRear) * 0.38);

  // Modelo físico de deflexión óptima de carcasa (15% tire drop) calibrado por volumen de cámara de aire y carga por rueda
  const computeBaseWheelPsi = (wheelLoadKg, effWidthMm) => {
    const loadFactor = 40 + (wheelLoadKg - 37) * 0.85;
    const widthFactor = Math.pow(28 / effWidthMm, 1.48);
    return loadFactor * widthFactor;
  };

  const baseFrontPsi = computeBaseWheelPsi(frontLoadKg, effFrontMm);
  const baseRearPsi = computeBaseWheelPsi(rearLoadKg, effRearMm);

  // Modificadores porcentuales transparentes
  let setupPct = 0;
  let setupLabel = 'Tubeless (-6% por ausencia de fricción cámara)';
  if (setup === 'tubeless') {
    setupPct = -6;
  } else if (setup === 'hookless') {
    setupPct = -8;
    setupLabel = 'Tubeless Hookless (-8% y límite ETRTO 72.5 PSI)';
  } else if (setup === 'tpu') {
    setupPct = -2;
    setupLabel = 'Cámara TPU / Látex (-2% menor histéresis)';
  } else {
    setupPct = 4;
    setupLabel = 'Cámara de Butilo (+4% protección llantazo)';
  }

  let casingPct = 0;
  if (casing === 'supple') casingPct = -2.5;
  else if (casing === 'reinforced') casingPct = -3.5;
  else if (casing === 'enduro') casingPct = -6;

  let surfacePct = 0;
  let surfaceLabel = 'Asfalto liso y seco (0%)';
  if (surface === 'rough_dry') {
    surfacePct = -5;
    surfaceLabel = 'Asfalto rugoso / roto (-5% absorción)';
  } else if (surface === 'wet') {
    surfacePct = -8;
    surfaceLabel = 'Mojado / Lluvia (-8% huella de contacto)';
  } else if (surface === 'gravel_fast') {
    surfacePct = -7;
    surfaceLabel = 'Gravel compacto (-7% filtrado vibración)';
  } else if (surface === 'gravel_chunky') {
    surfacePct = -12;
    surfaceLabel = 'Gravel suelto / piedra (-12% tracción)';
  } else if (surface === 'mtb_dry') {
    surfacePct = -14;
    surfaceLabel = 'MTB sendero y raíces (-14% lectura terreno)';
  } else if (surface === 'mtb_mud') {
    surfacePct = -19;
    surfaceLabel = 'MTB barro / roca húmeda (-19% máximo grip)';
  }

  let feelPct = 0;
  if (feel === 'comfort') feelPct = -4.5;
  else if (feel === 'fast') feelPct = 4;

  let insertPct = 0;
  if (insert === 'light') insertPct = -4;
  else if (insert === 'pro') insertPct = -8;

  const wheelSizePct = wheelSize === '650b' ? 3 : 0;
  const totalModPct = setupPct + casingPct + surfacePct + feelPct + insertPct + wheelSizePct;
  const mult = 1 + totalModPct / 100;

  let finalFrontPsi = Math.round(baseFrontPsi * mult);
  let finalRearPsi = Math.round(baseRearPsi * mult);

  // Límites de seguridad físicos y ETRTO Hookless
  const warningEl = document.getElementById('tp-hookless-warning');
  let warningMsg = '';
  if (setup === 'hookless' && (finalFrontPsi > 72 || finalRearPsi > 72)) {
    finalFrontPsi = Math.min(72, finalFrontPsi);
    finalRearPsi = Math.min(72, finalRearPsi);
    warningMsg =
      '⚠️ Límite de seguridad ETRTO Hookless aplicado: nunca superes 5.0 bar (72.5 PSI) en llantas sin gancho.';
  } else if (tireFrontMm >= 50 && finalFrontPsi < 14) {
    finalFrontPsi = 14;
    finalRearPsi = Math.max(16, finalRearPsi);
  }

  if (warningEl) {
    warningEl.style.display = warningMsg ? 'block' : 'none';
    warningEl.innerText = warningMsg;
  }

  const frontBar = (finalFrontPsi / 14.5038).toFixed(2);
  const rearBar = (finalRearPsi / 14.5038).toFixed(2);

  const badgeEl = document.getElementById('tp-total-weight-badge');
  if (badgeEl) badgeEl.innerText = `${totalKg} kg totales (${riderKg} + ${bikeKg} kg)`;

  const fPsiEl = document.getElementById('tp-front-psi');
  const rPsiEl = document.getElementById('tp-rear-psi');
  const fBarEl = document.getElementById('tp-front-bar');
  const rBarEl = document.getElementById('tp-rear-bar');
  const fLoadEl = document.getElementById('tp-front-load');
  const rLoadEl = document.getElementById('tp-rear-load');

  if (fPsiEl) fPsiEl.innerText = `${finalFrontPsi}`;
  if (rPsiEl) rPsiEl.innerText = `${finalRearPsi}`;
  if (fBarEl) fBarEl.innerText = `${frontBar} bar`;
  if (rBarEl) rBarEl.innerText = `${rearBar} bar`;
  if (fLoadEl) fLoadEl.innerText = `Reparto: ${Math.round(frontRatio * 100)}% (~${frontLoadKg} kg) · Balón real ${effFrontMm.toFixed(1)} mm`;
  if (rLoadEl) rLoadEl.innerText = `Reparto: ${Math.round(rearRatio * 100)}% (~${rearLoadKg} kg) · Balón real ${effRearMm.toFixed(1)} mm`;

  const breakdownList = document.getElementById('tp-breakdown-list');
  if (breakdownList) {
    const modSign = totalModPct > 0 ? '+' : '';
    breakdownList.innerHTML = `
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">1. Masa total sistema (Ciclista + Bici)</span>
        <span class="tp-breakdown-val">${totalKg} kg (${Math.round(frontRatio * 100)}% Del / ${Math.round(rearRatio * 100)}% Tras)</span>
      </div>
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">2. Anchura real medida en llanta de ${rimMm} mm</span>
        <span class="tp-breakdown-val">${effFrontMm.toFixed(1)} mm Del / ${effRearMm.toFixed(1)} mm Tras</span>
      </div>
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">3. Presión base por volumen y carga (15% drop)</span>
        <span class="tp-breakdown-val">${Math.round(baseFrontPsi)} PSI / ${Math.round(baseRearPsi)} PSI</span>
      </div>
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">4. Configuración (${setupLabel})</span>
        <span class="tp-breakdown-val">${setupPct > 0 ? '+' : ''}${setupPct}%</span>
      </div>
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">5. Terreno (${surfaceLabel})</span>
        <span class="tp-breakdown-val">${surfacePct > 0 ? '+' : ''}${surfacePct}%</span>
      </div>
      <div class="tp-breakdown-row">
        <span class="tp-breakdown-lbl">6. Ajuste neto combinado (Carcasa + Sensación + Mousse)</span>
        <span class="tp-breakdown-val">${modSign}${totalModPct.toFixed(1)}%</span>
      </div>
    `;
  }

  const rangeStrip = document.getElementById('tp-range-strip');
  if (rangeStrip) {
    const lowF = ((finalFrontPsi - 3) / 14.5038).toFixed(2);
    const lowR = ((finalRearPsi - 3) / 14.5038).toFixed(2);
    const highF = ((finalFrontPsi + 3) / 14.5038).toFixed(2);
    const highR = ((finalRearPsi + 3) / 14.5038).toFixed(2);
    rangeStrip.innerHTML = `
      <div class="tp-range-pill">
        <span>Mínimo (Lluvia / Grip)</span>
        <strong>${lowF} / ${lowR} bar</strong>
      </div>
      <div class="tp-range-pill">
        <span>Óptimo calculado</span>
        <strong style="color: var(--accent);">${frontBar} / ${rearBar} bar</strong>
      </div>
      <div class="tp-range-pill">
        <span>Máximo (Firme liso)</span>
        <strong>${highF} / ${highR} bar</strong>
      </div>
    `;
  }
}

function setupCyclingLab() {
  const bikeSelect = document.getElementById('tp-bike-select');
  if (bikeSelect) {
    bikeSelect.addEventListener('change', () => {
      const bike = gearList.find((g) => String(g._id) === String(bikeSelect.value));
      if (bike) applyBikePresetsToPressureLab(bike);
      calculateTirePressureLab();
    });
  }

  const discSelect = document.getElementById('tp-discipline');
  if (discSelect) {
    discSelect.addEventListener('change', () => {
      applyBikePresetsToPressureLab({ bikeType: discSelect.value });
      calculateTirePressureLab();
    });
  }

  [
    'tp-rider-weight',
    'tp-bike-weight',
    'tp-wheel-size',
    'tp-tire-width',
    'tp-tire-width-rear',
    'tp-rim-width',
    'tp-setup',
    'tp-casing',
    'tp-surface',
    'tp-feel',
    'tp-insert'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculateTirePressureLab);
      el.addEventListener('change', calculateTirePressureLab);
    }
  });
}

// ================= SUBIDA DE GPX =================
function setupUploadModal() {
  const modal = document.getElementById('upload-modal');
  const openBtn = document.getElementById('open-upload-modal-btn');
  const closeBtn = document.getElementById('close-upload-modal');
  const cancelBtn = document.getElementById('cancel-upload-btn');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('modal-gpx-input');
  const fileNameDisplay = document.getElementById('selected-file-name');
  const form = document.getElementById('upload-gpx-form');

  if (!modal) return;

  const closeModal = () => {
    modal.style.display = 'none';
  };
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      applyFavoriteGearToUploadForm();
      modal.style.display = 'flex';
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect(fileInput.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    if (fileNameDisplay) fileNameDisplay.innerText = file.name;
    const titleInput = document.getElementById('act-title');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Por favor selecciona un archivo .gpx');
        return;
      }

      const submitBtn = document.getElementById('submit-upload-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Subiendo…';
      }

      const formData = new FormData();
      formData.append('gpxFile', fileInput.files[0]);
      formData.append('title', document.getElementById('act-title').value);
      formData.append('type', document.getElementById('act-type').value);

      const selectedGearVal = document.getElementById('act-gear-select')?.value || '';
      const customGearText = document.getElementById('act-gear')?.value || '';
      if (selectedGearVal && selectedGearVal !== '__custom__') {
        formData.append('gearId', selectedGearVal);
      } else if (selectedGearVal === '__custom__' && customGearText.trim()) {
        formData.append('gear', customGearText.trim());
      }

      formData.append('perceivedExertion', document.getElementById('act-rpe').value);
      formData.append('description', document.getElementById('act-desc').value);

      try {
        const res = await apiFetch('/api/activities/upload-gpx', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && data.activity) {
          closeModal();
          form.reset();
          applyFavoriteGearToUploadForm();
          if (fileNameDisplay) fileNameDisplay.innerText = 'Ningún archivo seleccionado';
          await loadGear();
          await loadActivities();
          await loadStatsSummary();
          loadActivityIntoViewer(data.activity._id);
        } else {
          alert('Error al guardar la actividad: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        alert('Error de conexión al subir GPX: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Guardar actividad';
        }
      }
    });
  }
}

// ================= MODAL DE EDICIÓN =================
function setupEditModal() {
  const modal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('close-edit-modal');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const form = document.getElementById('edit-form');

  if (!modal) return;

  const closeModal = () => {
    modal.style.display = 'none';
  };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-id').value;
      const title = document.getElementById('edit-title').value;
      const type = document.getElementById('edit-type').value;
      const description = document.getElementById('edit-desc').value;

      const selectedGearVal = document.getElementById('edit-gear-select')?.value || '';
      const customGearText = document.getElementById('edit-gear')?.value || '';
      const payload = { title, type, description };
      if (selectedGearVal && selectedGearVal !== '__custom__') {
        payload.gearId = selectedGearVal;
      } else if (selectedGearVal === '__custom__') {
        payload.gear = customGearText.trim();
        payload.gearId = null;
      } else {
        payload.gear = '';
        payload.gearId = null;
      }

      try {
        const res = await apiFetch(`/api/activities/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          closeModal();
          await loadGear();
          await loadActivities();
          if (currentActivity && currentActivity._id === id) {
            loadActivityIntoViewer(id);
          }
        }
      } catch (err) {
        alert('Error guardando cambios: ' + err.message);
      }
    });
  }
}

// ================= CONFIGURACIÓN DE AUTH Y MI PERFIL =================
function loadAllUserData() {
  activeGearFilter = 'all';
  loadGear();
  loadActivities();
  loadStatsSummary();
}

async function initAuthAndProfile() {
  const loginForm = document.getElementById('login-form');
  const authError = document.getElementById('auth-error');

  const showError = (msg) => {
    if (!authError) return;
    if (msg) {
      authError.innerText = msg;
      authError.style.display = 'block';
    } else {
      authError.style.display = 'none';
    }
  };

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = document.getElementById('login-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Verificando…';
      }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
          setAuthSession(data.token, data.user);
          showAuthScreen(false);
          switchTab('activities');
          loadAllUserData();
        } else {
          showError(data.error || 'Credenciales incorrectas');
        }
      } catch (err) {
        showError('Error de conexión con el servidor');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Iniciar sesión';
        }
      }
    });
  }

  // Botón usuario en el header -> va a Mi Perfil
  const headerUserBtn = document.getElementById('header-user-btn');
  if (headerUserBtn) {
    headerUserBtn.addEventListener('click', () => switchTab('profile'));
  }

  // Editar perfil propio en Mi Perfil
  const toggleEditProfileBtn = document.getElementById('toggle-edit-profile-btn');
  const cancelProfileEditBtn = document.getElementById('cancel-profile-edit-btn');
  const profileEditForm = document.getElementById('profile-edit-form');
  const profileSaveMsg = document.getElementById('profile-save-msg');

  if (toggleEditProfileBtn && profileEditForm) {
    toggleEditProfileBtn.addEventListener('click', () => {
      const isHidden = profileEditForm.style.display === 'none';
      profileEditForm.style.display = isHidden ? 'flex' : 'none';
      if (profileSaveMsg) profileSaveMsg.innerText = '';
    });
  }

  if (cancelProfileEditBtn && profileEditForm) {
    cancelProfileEditBtn.addEventListener('click', () => {
      profileEditForm.style.display = 'none';
    });
  }

  if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('prof-name').value,
        email: document.getElementById('prof-email').value,
        location: document.getElementById('prof-location').value,
        primarySport: document.getElementById('prof-sport').value,
        weightKg: document.getElementById('prof-weight').value,
        ftpWatts: document.getElementById('prof-ftp').value,
        maxHeartrate: document.getElementById('prof-maxhr').value,
        bio: document.getElementById('prof-bio').value,
        newPassword: document.getElementById('prof-password').value
      };

      try {
        const res = await apiFetch('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.user) {
          currentUser = data.user;
          updateUserUI();
          if (profileSaveMsg) profileSaveMsg.innerText = '✓ Perfil actualizado';
          setTimeout(() => {
            if (profileSaveMsg) profileSaveMsg.innerText = '';
            profileEditForm.style.display = 'none';
          }, 1000);
        } else {
          alert(data.error || 'Error actualizando perfil');
        }
      } catch (err) {
        alert('Error guardando perfil: ' + err.message);
      }
    });
  }

  // Integración Garmin Edge 1040 (Generar / Copiar / Revocar clave privada)
  const garminGenBtn = document.getElementById('garmin-generate-key-btn');
  const garminRevokeBtn = document.getElementById('garmin-revoke-key-btn');
  const garminNewBox = document.getElementById('garmin-new-key-box');
  const garminNewVal = document.getElementById('garmin-new-key-value');
  const garminCopyBtn = document.getElementById('garmin-copy-key-btn');

  if (garminGenBtn) {
    garminGenBtn.addEventListener('click', async () => {
      garminGenBtn.disabled = true;
      garminGenBtn.innerText = 'Generando…';
      try {
        const res = await apiFetch('/api/auth/garmin-key', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.apiKey) {
          currentUser = data.user;
          updateUserUI();
          if (garminNewVal) garminNewVal.innerText = data.apiKey;
          if (garminNewBox) garminNewBox.style.display = 'flex';
        } else {
          alert(data.error || 'No se pudo generar la clave Garmin');
        }
      } catch (err) {
        alert('Error generando clave Garmin: ' + err.message);
      } finally {
        garminGenBtn.disabled = false;
        garminGenBtn.innerText = 'Generar clave Garmin';
      }
    });
  }

  if (garminCopyBtn && garminNewVal) {
    garminCopyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(garminNewVal.innerText.trim());
        garminCopyBtn.innerText = '✓ Copiada';
        setTimeout(() => {
          garminCopyBtn.innerText = 'Copiar clave';
        }, 1500);
      } catch {
        alert('Copia manualmente la clave mostrada.');
      }
    });
  }

  if (garminRevokeBtn) {
    garminRevokeBtn.addEventListener('click', async () => {
      if (!confirm('¿Revocar la clave actual del Garmin Edge 1040? Dejará de sincronizar hasta que generes una nueva.')) {
        return;
      }
      try {
        const res = await apiFetch('/api/auth/garmin-key', { method: 'DELETE' });
        const data = await res.json();
        if (data.success && data.user) {
          currentUser = data.user;
          updateUserUI();
          if (garminNewBox) garminNewBox.style.display = 'none';
          if (garminNewVal) garminNewVal.innerText = '';
        }
      } catch (err) {
        alert('Error revocando clave Garmin: ' + err.message);
      }
    });
  }

  // Cerrar sesión: limpiar token, estado privado en memoria y volver al login
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setAuthSession(null, null);
      clearPrivateClientState();
      showAuthScreen(true);
    });
  }

  // Verificación estricta de sesión existente (SIN auto-login)
  const existingToken = getAuthToken();
  if (existingToken) {
    try {
      const res = await apiFetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        updateUserUI();
        showAuthScreen(false);
        switchTab('activities');
        loadAllUserData();
        return;
      }
    } catch {
      // Token inválido o expirado
    }
    setAuthSession(null, null);
  }

  clearPrivateClientState();
  showAuthScreen(true);
}
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('route3d_theme') || 'light');

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  initMap();

  const logoBtn = document.getElementById('logo-home-btn');
  if (logoBtn) {
    logoBtn.addEventListener('click', () => switchTab('activities'));
  }

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const sportChips = document.querySelectorAll('#sport-filters .filter-chip');
  sportChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      sportChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeSportFilter = chip.dataset.type;
      loadActivities();
    });
  });

  const gearCatChips = document.querySelectorAll('#gear-category-filters .filter-chip');
  gearCatChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      gearCatChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeGearCategoryFilter = chip.dataset.category;
      renderGearCards();
    });
  });

  const gearFilterSelect = document.getElementById('activity-gear-filter');
  if (gearFilterSelect) {
    gearFilterSelect.addEventListener('change', (e) => {
      activeGearFilter = e.target.value;
      loadActivities();
    });
  }

  const dateFromInput = document.getElementById('activity-date-from');
  const dateToInput = document.getElementById('activity-date-to');
  const clearDateRangeBtn = document.getElementById('clear-date-range-btn');

  const syncDateFilter = () => {
    activeDateFrom = dateFromInput?.value || '';
    activeDateTo = dateToInput?.value || '';
    if (clearDateRangeBtn) {
      clearDateRangeBtn.style.display = activeDateFrom || activeDateTo ? 'inline-flex' : 'none';
    }
    loadActivities();
  };

  if (dateFromInput) dateFromInput.addEventListener('change', syncDateFilter);
  if (dateToInput) dateToInput.addEventListener('change', syncDateFilter);
  if (clearDateRangeBtn) {
    clearDateRangeBtn.addEventListener('click', () => {
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      syncDateFilter();
    });
  }

  const actGearSelect = document.getElementById('act-gear-select');
  const actGearInput = document.getElementById('act-gear');
  if (actGearSelect && actGearInput) {
    actGearSelect.addEventListener('change', () => {
      actGearInput.style.display = actGearSelect.value === '__custom__' ? 'block' : 'none';
      if (actGearSelect.value === '__custom__') actGearInput.focus();
    });
  }

  const actTypeSelect = document.getElementById('act-type');
  if (actTypeSelect) {
    actTypeSelect.addEventListener('change', () => {
      selectRecommendedGearForSport(actTypeSelect.value, actGearSelect, actGearInput);
    });
  }

  const editGearSelect = document.getElementById('edit-gear-select');
  const editGearInput = document.getElementById('edit-gear');
  if (editGearSelect && editGearInput) {
    editGearSelect.addEventListener('change', () => {
      editGearInput.style.display = editGearSelect.value === '__custom__' ? 'block' : 'none';
      if (editGearSelect.value === '__custom__') editGearInput.focus();
    });
  }

  const searchInput = document.getElementById('activity-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        loadActivities();
      }, 250);
    });
  }

  const sortSelect = document.getElementById('activity-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      loadActivities();
    });
  }

  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.addEventListener('click', togglePlayback);

  const toggle3DBtn = document.getElementById('toggle-3d-btn');
  if (toggle3DBtn) {
    toggle3DBtn.addEventListener('click', () => set3DMode(!is3DMode));
  }

  const mapBackBtn = document.getElementById('map-back-btn');
  if (mapBackBtn) {
    mapBackBtn.addEventListener('click', () => switchTab('activities'));
  }

  const resetCamBtn = document.getElementById('reset-cam-btn');
  if (resetCamBtn) {
    resetCamBtn.addEventListener('click', () => {
      fitViewerMapToCurrentRoute({ duration: 800 });
    });
  }

  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.addEventListener('input', (e) => {
      if (routeDistanceKm <= 0) return;
      currentDistanceKm = (parseFloat(e.target.value) / 100) * routeDistanceKm;
      isPlaying = false;
      setPlayButtonState(false);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      updateCameraAndHUD();
    });
  }

  const speedSelector = document.getElementById('speed-selector');
  if (speedSelector) {
    speedSelector.addEventListener('change', (e) => {
      speedMultiplier = parseFloat(e.target.value);
    });
  }

  // Cerrar modales con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const uploadModal = document.getElementById('upload-modal');
      const editModal = document.getElementById('edit-modal');
      const gearModal = document.getElementById('gear-modal');
      const maintModal = document.getElementById('maintenance-modal');
      if (uploadModal) uploadModal.style.display = 'none';
      if (editModal) editModal.style.display = 'none';
      if (gearModal) gearModal.style.display = 'none';
      if (maintModal) maintModal.style.display = 'none';
    }
  });

  setupElevationCanvasHover();
  setupUploadModal();
  setupEditModal();
  setupGearModal();
  setupMaintenanceModal();
  setupSegmentCreator();
  setupSegmentsZone();
  setupRoutePlanner();
  setupCyclingLab();

  checkBackendHealth();
  initAuthAndProfile();
});
