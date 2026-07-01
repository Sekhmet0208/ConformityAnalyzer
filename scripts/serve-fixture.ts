import { serveFixture } from '../tests/helpers/fixture-server.js';

const folder = (process.argv[2] as 'compliant' | 'non-compliant') ?? 'non-compliant';
const srv = await serveFixture(folder);
process.stdout.write(srv.origin + '\n');
// Garde le serveur ouvert jusqu'a interruption.
setInterval(() => {}, 1 << 30);
