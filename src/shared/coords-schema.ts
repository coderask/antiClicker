// src/shared/coords-schema.ts
//
// Single source of truth for coordinate validation — reused by the launcher
// module and Phase 3's IPC validation layer.
//
// ZodCoordsSchema enforces the WGS-84 coordinate bounds that Chromium/CDP
// requires: latitude in [-90, 90], longitude in [-180, 180]. Accuracy is
// optional (positive number, in metres); the launcher defaults to 50 when
// omitted.

import { z } from 'zod';

export const ZodCoordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

/** Validated WGS-84 coordinates. Inferred from ZodCoordsSchema. */
export type Coords = z.infer<typeof ZodCoordsSchema>;
