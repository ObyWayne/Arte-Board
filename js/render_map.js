/* ── render_map.js — Carte OpenStreetMap (Leaflet) ── */
/* ═══════════════════════════════════════════════
   ÉTAT
═══════════════════════════════════════════════ */
let _map        = null;
let _mapTileType = 'standard';
let _mapTileObj  = null;
let _mapLayers   = {route: null, markers: null, geojson: null};
let _mapGeoJSON  = null;

// Partagées avec ui_interactions.js (fsOpenRadar)
let _lastRadarAll      = [];
let _lastRadarFiltered = [];

/* ═══════════════════════════════════════════════
   TUILES
═══════════════════════════════════════════════ */
const _MAP_TILES = {
  standard:  { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                                     attr:'© OpenStreetMap' },
  satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',          attr:'© Esri' },
  transport: { url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',                               attr:'© CartoDB' },
};

function setMapTile(type){
  _mapTileType = type;
  document.querySelectorAll('.map-tile-btn').forEach(b=>b.classList.toggle('active',b.dataset.tile===type));
  if(!_map) return;
  if(_mapTileObj){ _map.removeLayer(_mapTileObj); }
  const t = _MAP_TILES[type] || _MAP_TILES.standard;
  _mapTileObj = L.tileLayer(t.url, {maxZoom:19, attribution:t.attr}).addTo(_map);
}

/* ═══════════════════════════════════════════════
   INIT + RENDU
═══════════════════════════════════════════════ */
function initMap(){
  if(_map) return;
  const el = document.getElementById('osmMap');
  if(!el) return;
  el.innerHTML = '';
  _map = L.map('osmMap', {zoomControl:true, attributionControl:true});
  const _t = _MAP_TILES[_mapTileType] || _MAP_TILES.standard;
  _mapTileObj = L.tileLayer(_t.url, {maxZoom:19, attribution:_t.attr}).addTo(_map);
  _map.setView([46.5, 2.3], 6);
}

function renderMap(){
  initMap();
  const col = BRAND.primaire1 || '#a06bff';

  // Nettoie les couches précédentes
  ['route','markers','geojson'].forEach(k => {
    if(_mapLayers[k]){ _map.removeLayer(_mapLayers[k]); _mapLayers[k]=null; }
  });

  // ── 1. GeoJSON tracé précis (depuis ZIP) ──
  if(_mapGeoJSON){
    _mapLayers.geojson = L.geoJSON(_mapGeoJSON, {
      style: f => f.geometry.type === 'LineString'
        ? { color: col, weight: 5, opacity: .9 }
        : {},
      pointToLayer: (f, latlng) => {
        const isT = f.properties.type === 'terminus';
        return L.circleMarker(latlng, {
          radius: isT ? 9 : 6,
          fillColor: isT ? col : '#fff',
          color: col, weight: 2.5, opacity: 1,
          fillOpacity: isT ? 1 : .95
        });
      },
      onEachFeature: (f, layer) => {
        if(f.properties.name) layer.bindTooltip(f.properties.name, {
          permanent: false, direction: 'top', className: 'map-tooltip'
        });
      }
    }).addTo(_map);
    _map.fitBounds(_mapLayers.geojson.getBounds(), {padding:[28,28]});
  }

  // ── 2. Stations depuis LAT/LON dans la feuille STATIONS ──
  if(!LINE || !LINE.stations || !LINE.stations.length) return;

  const pts = LINE.stations.map(s => {
    const lat = parseFloat(s.lat||s.latitude||s.LAT||'');
    const lon = parseFloat(s.lon||s.lng||s.longitude||s.LON||'');
    return (!isNaN(lat)&&!isNaN(lon)) ? {lat,lon,nom:s.nom} : null;
  }).filter(Boolean);

  if(!pts.length){
    if(!_mapGeoJSON){
      const el = document.getElementById('osmMap');
      if(el) el.innerHTML =
        `<div class="map-no-data"><div class="map-no-data-icon">📍</div>
         <div>${T('noMapCoords')}</div></div>`;
    }
    return;
  }

  const latlngs = pts.map(p => [p.lat, p.lon]);

  // Tracé uniquement si pas déjà un GeoJSON
  if(!_mapGeoJSON){
    _mapLayers.route = L.polyline(latlngs, {color:col, weight:4, opacity:.85}).addTo(_map);
  }

  // Marqueurs stations
  const group = L.layerGroup();
  pts.forEach((p, i) => {
    const isT = (i===0 || i===pts.length-1);
    L.circleMarker([p.lat,p.lon], {
      radius: isT ? 8 : 5,
      fillColor: isT ? col : '#fff',
      color: col, weight:2, opacity:1, fillOpacity: isT ? 1 : .9
    }).bindTooltip(p.nom, {permanent:false, direction:'top', className:'map-tooltip'})
      .addTo(group);
  });
  _mapLayers.markers = group.addTo(_map);

  if(!_mapGeoJSON && _mapLayers.route)
    _map.fitBounds(_mapLayers.route.getBounds(), {padding:[24,24]});
}

/* ── Fullscreen carte ── */
function fsOpenMap(){
  openFullscreen(document.getElementById('compMapTitle').textContent, body => {
    Object.assign(body.style, {padding:'0', overflow:'hidden'});
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;min-height:400px;';
    wrap.id = 'osmMapFs';
    body.appendChild(wrap);
    // Attend que le DOM soit rendu avant d'init Leaflet
    setTimeout(()=>{
      const fsMap = L.map('osmMapFs', {zoomControl:true, attributionControl:true});
      const _ft = _MAP_TILES[_mapTileType] || _MAP_TILES.standard;
      L.tileLayer(_ft.url, {maxZoom:19, attribution:_ft.attr}).addTo(fsMap);
      const col = BRAND.primaire1 || '#a06bff';
      if(LINE && LINE.stations){
        const pts = LINE.stations
          .map(s=>({lat:parseFloat(s.lat||s.latitude||s.LAT||''),lon:parseFloat(s.lon||s.lng||s.longitude||s.LON||''),nom:s.nom}))
          .filter(p=>!isNaN(p.lat)&&!isNaN(p.lon));
        if(pts.length){
          const poly = L.polyline(pts.map(p=>[p.lat,p.lon]),{color:col,weight:5,opacity:.85}).addTo(fsMap);
          pts.forEach((p,i)=>{
            const isT=i===0||i===pts.length-1;
            L.circleMarker([p.lat,p.lon],{radius:isT?10:6,fillColor:isT?col:'#fff',color:col,weight:2,fillOpacity:isT?1:.9})
             .bindTooltip(p.nom,{permanent:false,direction:'top'}).addTo(fsMap);
          });
          fsMap.fitBounds(poly.getBounds(),{padding:[32,32]});
        } else if(_mapGeoJSON){
          const layer = L.geoJSON(_mapGeoJSON,{style:{color:col,weight:5}}).addTo(fsMap);
          fsMap.fitBounds(layer.getBounds(),{padding:[32,32]});
        } else {
          fsMap.setView([46.5,2.3],6);
        }
      } else {
        fsMap.setView([46.5,2.3],6);
      }
      fsMap.invalidateSize();
    }, 150);
  });
}
