// src/renderer/src/CoordInput.tsx
//
// Coordinate entry form. Lives inside the floating command bar.
// Accepts lat/lng numeric entry OR a Google Maps URL that auto-parses to
// fill the lat/lng inputs.

import { useState } from 'react';
import { z } from 'zod';
import { parseMapsUrl } from './utils/parseMapsUrl';
import { theme } from './theme';

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
      setError('Lat and lng must be numbers.');
      return;
    }
    const result = CoordsFormSchema.safeParse({ latitude: lat, longitude: lng });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(' '));
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
        setError('No coordinates found in URL.');
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="coord-input-form"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <input
        type="number"
        step="any"
        placeholder="lat"
        value={latStr}
        onChange={(e) => setLatStr(e.target.value)}
        data-testid="lat-input"
        className="ac-input"
        style={{ width: 86, padding: '5px 8px', fontSize: 11 }}
      />
      <input
        type="number"
        step="any"
        placeholder="lng"
        value={lngStr}
        onChange={(e) => setLngStr(e.target.value)}
        data-testid="lng-input"
        className="ac-input"
        style={{ width: 86, padding: '5px 8px', fontSize: 11 }}
      />
      <button
        type="submit"
        data-testid="coord-submit"
        className="ac-btn"
        style={{
          padding: '5px 10px',
          fontSize: 10,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Go
      </button>
      <input
        type="text"
        placeholder="or paste Google Maps URL…"
        value={urlStr}
        onChange={(e) => handleUrlChange(e.target.value)}
        data-testid="maps-url-input"
        className="ac-input"
        style={{
          width: 200,
          padding: '5px 8px',
          fontSize: 11,
          fontFamily: theme.font.body,
        }}
      />
      {error && (
        <span
          data-testid="coord-error"
          role="alert"
          className="ac-mono"
          style={{
            color: theme.color.danger,
            fontSize: 10,
            letterSpacing: '0.02em',
          }}
        >
          {error}
        </span>
      )}
    </form>
  );
}
