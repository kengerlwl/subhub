/**
 * GET /api/sub - 返回免费节点订阅
 * 参数：target=clash|v2ray|singbox|surge|shadowrocket
 *       country=US|JP|HK|SG|...
 *       limit=数量
 */

import { toClash, toV2ray, toSingbox, toSurge, toShadowrocket } from '../lib/converter.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get('target') || 'clash';
  const country = url.searchParams.get('country') || '';
  const limit = parseInt(url.searchParams.get('limit') || '0');
  const rules = url.searchParams.get('rules') || 'minimal';
  const kernel = url.searchParams.get('kernel') || 'clash'; // clash (default) or mihomo

  try {
    // 从 KV 读取节点数据
    const data = await env.SUBHUB_KV.get('nodes:latest', 'json');
    if (!data || !data.nodes || data.nodes.length === 0) {
      return new Response('No nodes available. Please wait for the next collection cycle.', {
        status: 503,
        headers: corsHeaders('text/plain'),
      });
    }

    let nodes = data.nodes;

    // 按国家筛选
    if (country) {
      const countries = country.toUpperCase().split(',');
      nodes = nodes.filter(n => countries.includes(n.country));
    }

    // 限制数量
    if (limit > 0) {
      nodes = nodes.slice(0, limit);
    }

    if (nodes.length === 0) {
      return new Response('No nodes match your filter criteria.', {
        status: 404,
        headers: corsHeaders('text/plain'),
      });
    }

    // 转换格式
    let content, contentType;
    switch (target.toLowerCase()) {
      case 'clash':
      case 'mihomo':
        content = toClash(nodes, rules, kernel);
        contentType = 'text/yaml; charset=utf-8';
        break;
      case 'v2ray':
      case 'v2rayn':
        content = toV2ray(nodes);
        contentType = 'text/plain; charset=utf-8';
        break;
      case 'singbox':
      case 'sing-box':
        content = toSingbox(nodes, rules);
        contentType = 'application/json; charset=utf-8';
        break;
      case 'surge':
        content = toSurge(nodes);
        contentType = 'text/plain; charset=utf-8';
        break;
      case 'shadowrocket':
        content = toShadowrocket(nodes);
        contentType = 'text/plain; charset=utf-8';
        break;
      default:
        content = toClash(nodes, rules, kernel);
        contentType = 'text/yaml; charset=utf-8';
    }

    return new Response(content, {
      headers: {
        ...corsHeaders(contentType),
        'Content-Disposition': `attachment; filename="subhub_${target}.${target === 'singbox' ? 'json' : 'yaml'}"`,
        'Cache-Control': 'public, max-age=300',
        'Subscription-Userinfo': `upload=0; download=0; total=107374182400; expire=${Math.floor(Date.now() / 1000) + 86400 * 30}`,
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, {
      status: 500,
      headers: corsHeaders('text/plain'),
    });
  }
}

function corsHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders('text/plain') });
}
