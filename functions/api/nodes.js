/**
 * GET /api/nodes - 返回节点列表 JSON（供前端渲染）
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const data = await env.SUBHUB_KV.get('nodes:latest', 'json');
    if (!data) {
      return jsonResponse({ nodes: [], stats: { totalCollected: 0, uniqueCount: 0, updatedAt: null } });
    }

    // 返回节点列表（去掉 raw 字段，减少传输量）
    const safeNodes = data.nodes.map(n => ({
      type: n.type,
      name: n.name,
      server: maskServer(n.server),
      port: n.port,
      country: n.country,
    }));

    return jsonResponse({
      nodes: safeNodes,
      stats: data.stats,
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * 部分隐藏服务器地址（安全考虑，前端展示用）
 */
function maskServer(server) {
  if (!server) return '***';
  const parts = server.split('.');
  if (parts.length >= 3) {
    return parts[0] + '.***.***.' + parts[parts.length - 1];
  }
  return server.slice(0, 3) + '***';
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
