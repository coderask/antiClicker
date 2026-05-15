// src/renderer/src/CoordInput.tsx
//
// Coordinate input form for Phase 4 Map UI.
//
// Features:
//  - Two number inputs for latitude and longitude
//  - A text input for pasting a Google Maps URL (auto-extracts coordinates on change)
//  - zod-validated submit (lat: -90..90, lng: -180..180)
//  - Inline error display with data-testid="coord-error"

import { useState } from 'react';
import { z } from 'zod';
import { parseMapsUrl } from './utils/parseMapsUrl';

const CoordsFormSchema = z.object({
  latitude: z
    .number({ error: 'Latitude must be a number.' })
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.'),
  longitude: z
    .number({ error: 'Longitude must be a number.' })
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.'),
});

interface CoordInputProps {
  onSubmit: (coords: { latitude: number; longitude: number }) => void;
}

export default function CoordInput({ onSubmit }: CoordInputProps) {
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [urlStr, setUrlStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Latitude and longitude must be numbers.');
      return;
    }

    const result = CoordsFormSchema.safeParse({ latitude: lat, longitude: lng });
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      setError(messages);
      return;
    }

    setError(null);
    onSubmit({ latitude: result.data.latitude, longitude: result.data.longitude });
  };

  const handleUrlChange = (value: string) => {
    setUrlStr(value);

    if (value.length > 10) {
      const parsed = parseMapsUrl(value);
      if (parsed) {
        setLatStr(parsed.latitude.toFixed(6));
        setLngStr(parsed.longitude.toFixed(6));
        setError(null);
        setUrlStr('');
      } else if (value.includes('http')) {
        setError('Could not parse coordinates from URL.');
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: 100,
    padding: '3px 6px',
    background: '#2a2a3e',
    color: '#eee',
    border: '1px solid #444',
    borderRadius: 3,
    fontSize: 12,
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="coord-input-form"
      style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input
        type="number"
        step="any"
        placeholder="Latitude"
        value={latStr}
        onChange={(e) => setLatStr(e.target.value)}
        data-testid="lat-input"
        style={inputStyle}
      />
      <input
        type="number"
        step="any"
        placeholder="Longitude"
        value={lngStr}
        onChange={(e) => setLngStr(e.target.value)}
        data-testid="lng-input"
        style={inputStyle}
      />
      <button
        type="submit"
        data-testid="coord-submit"
        style={{
          padding: '3px 10px',
          background: '#3a3a5e',
          color: '#eee',
          border: '1px solid #555',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Go
      </button>
      <input
        type="text"
        placeholder="Paste Google Maps URL"
        value={urlStr}
        onChange={(e) => handleUrlChange(e.target.value)}
        data-testid="maps-url-input"
        style={{ ...inputStyle, width: 180 }}
      />
      {error && (
        <span
          data-testid="coord-error"
          role="alert"
          style={{ color: '#ff8080', fontSize: 11 }}
        >
          {error}
        </span>
      )}
    </form>
  );
}
