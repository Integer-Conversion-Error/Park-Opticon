import { useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

if (!MAPTILER_KEY) {
  console.warn('[SimpleMap] VITE_MAPTILER_API_KEY is not set. Please add it to your .env file.');
}

export default function SimpleMap({ spots = [] }) {
  const [viewState, setViewState] = useState({
    latitude: 45.4215,
    longitude: -75.6972,
    zoom: 13
  });

  console.log('[SimpleMap] Rendering with', spots.length, 'spots');
  console.log('[SimpleMap] MapTiler key:', MAPTILER_KEY);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`}
      >
        <NavigationControl position="top-right" />
        
        {spots.map(spot => (
          spot.latitude && spot.longitude ? (
            <Marker
              key={spot.id}
              latitude={spot.latitude}
              longitude={spot.longitude}
              color={spot.status === 'available' ? 'green' : 'red'}
            />
          ) : null
        ))}
      </Map>
    </div>
  );
}
