import { searchIndex } from '../lib/search';
export const GET = async () => new Response(JSON.stringify(await searchIndex('de')), { headers: { 'Content-Type': 'application/json' } });
