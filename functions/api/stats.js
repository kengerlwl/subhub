/**
 * GET /api/stats - 返回统计数据
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const data = await env.SUBHUB_KV.get('nodes:latest', 'json');
    if (!data) {
      return jsonResponse({
        totalNodes: 0,
        protocols: {},
        countries: {},
        updatedAt: null,
      });
    }

    const nodes = data.nodes || [];

    // 按协议统计
    const protocols = {};
    for (const n of nodes) {
      protocols[n.type] = (protocols[n.type] || 0) + 1;
    }

    // 按国家统计
    const countries = {};
    for (const n of nodes) {
      countries[n.country] = (countries[n.country] || 0) + 1;
    }

    return jsonResponse({
      totalNodes: nodes.length,
      protocols,
      countries,
      updatedAt: data.stats?.updatedAt || null,
      sources: data.stats?.sources?.map(s => ({ name: s.source, count: s.count })) || [],
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
