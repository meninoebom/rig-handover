import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from '../digest/read.js';

export function digestApi(config: RigConfig): Hono {
  const app = new Hono();

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(config.runsDir, night);
    if (result === null) return c.json({ error: 'no digest for this night', night }, 404);
    return c.json(result);
  });

  return app;
}
