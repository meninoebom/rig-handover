import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from '../digest/read.js';
import { lane } from '../lane.js';
import { DigestView } from '../views/digest.js';
import { Layout } from '../views/layout.js';

export function digestPage(config: RigConfig): Hono {
  const page = new Hono();

  page.get('/digest/:night', (c) => {
    const nightId = c.req.param('night');
    const night = readNight(config.runsDir, nightId);
    if (night === null) {
      return c.html(
        <Layout title="not found" lane={lane()}>
          <h1>not found</h1>
          <p class="mute">no digest for {nightId}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night.night}`} lane={lane()}>
        <DigestView night={night} />
      </Layout>,
    );
  });

  return page;
}
