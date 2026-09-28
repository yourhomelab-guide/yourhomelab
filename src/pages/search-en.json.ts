import { searchIndex } from '../lib/search';
export const GET = async () => new Response(JSON.stringify(await searchIndex('en')), { headers: { 'Content-Type': 'application/json' } });
