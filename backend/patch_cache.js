const fs = require('fs');
let file = fs.readFileSync('src/routes/reports.ts', 'utf8');

if (!file.includes('getRequestCacheKey')) {
  file = file.replace('function setCached', 'function getRequestCacheKey(route: string, query: any): string {\n  const qs = Object.keys(query || {}).sort().map(k => `${k}=${query[k]}`).join(\'&\');\n  return `${route}?${qs}`;\n}\n\nfunction setCached');

  const endpoints = ['district', 'date-wise', 'mode-receipt', 'nature-incident', 'type-against', 'status', 'complaint-source', 'type-complaint', 'branch-wise', 'highlights', 'action-taken'];
  
  for (const ep of endpoints) {
    const routeDef = `/reports/${ep}', { preHandler: [authenticate] }, async (request, reply) => {\n    try {\n`;
    const cacheLogic = `      const CACHE_KEY = getRequestCacheKey('reports:${ep}', request.query);\n      const cached = getCached<object>(CACHE_KEY);\n      if (cached) return sendSuccess(reply, cached);\n\n`;
    file = file.replace(routeDef, routeDef + cacheLogic);
  }
  
  file = file.replace(/return sendSuccess\(reply, (\{[\s\S]*?\})\);/g, (match, p1) => {
    // skip the filter-options which doesn't have CACHE_KEY set via getRequestCacheKey
    if (match.includes('year: yearNum')) {
      return `const result = ${p1};\n      setCached(CACHE_KEY, result);\n      return sendSuccess(reply, result);`;
    }
    return match;
  });
  
  fs.writeFileSync('src/routes/reports.ts', file);
  console.log('Cache logic added to reports.ts');
} else {
  console.log('Already added');
}
