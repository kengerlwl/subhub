/**
 * POST /api/convert - 订阅格式转换
 * Body: { url: "订阅链接或节点链接", target: "clash", rules: "minimal" }
 * 也支持 GET: /api/convert?url=xxx&target=clash
 */

import { parseSubscription } from '../lib/parser.js';
import { toClash, toV2ray, toSingbox, toSurge, toShadowrocket } from '../lib/converter.js';

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();
    const { url, content, target = 'clash', rules = 'minimal' } = body;

    let nodeContent = content || '';

    // 如果提供了 URL，先 fetch 获取内容
    if (url) {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'SubHub/1.0 (Subscription Converter)' },
      });
      if (!resp.ok) {
        return jsonResponse({ error: `Failed to fetch subscription: HTTP ${resp.status}` }, 400);
      }
      nodeContent = await resp.text();
    }

    if (!nodeContent) {
      return jsonResponse({ error: 'Please provide url or content' }, 400);
    }

    // 解析节点
    const nodes = parseSubscription(nodeContent);
    if (nodes.length === 0) {
      return jsonResponse({ error: 'No valid nodes found in the subscription' }, 400);
    }

    // 转换
    const result = convertNodes(nodes, target, rules);

    return new Response(result.content, {
      headers: {
        'Content-Type': result.contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const subUrl = url.searchParams.get('url');
  const target = url.searchParams.get('target') || 'clash';
  const rules = url.searchParams.get('rules') || 'minimal';

  if (!subUrl) {
    return jsonResponse({ error: 'Please provide url parameter' }, 400);
  }

  try {
    const resp = await fetch(subUrl, {
      headers: { 'User-Agent': 'SubHub/1.0 (Subscription Converter)' },
    });
    if (!resp.ok) {
      return jsonResponse({ error: `Failed to fetch subscription: HTTP ${resp.status}` }, 400);
    }
    const content = await resp.text();
    const nodes = parseSubscription(content);

    if (nodes.length === 0) {
      return jsonResponse({ error: 'No valid nodes found' }, 400);
    }

    const result = convertNodes(nodes, target, rules);

    return new Response(result.content, {
      headers: {
        'Content-Type': result.contentType,
        'Access-Control-Allow-Origin': '*',
        'Subscription-Userinfo': `upload=0; download=0; total=107374182400; expire=${Math.floor(Date.now() / 1000) + 86400 * 30}`,
      },
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function convertNodes(nodes, target, rules) {
  switch (target.toLowerCase()) {
    case 'clash':
    case 'mihomo':
      return { content: toClash(nodes, rules), contentType: 'text/yaml; charset=utf-8' };
    case 'v2ray':
    case 'v2rayn':
      return { content: toV2ray(nodes), contentType: 'text/plain; charset=utf-8' };
    case 'singbox':
    case 'sing-box':
      return { content: toSingbox(nodes, rules), contentType: 'application/json; charset=utf-8' };
    case 'surge':
      return { content: toSurge(nodes), contentType: 'text/plain; charset=utf-8' };
    case 'shadowrocket':
      return { content: toShadowrocket(nodes), contentType: 'text/plain; charset=utf-8' };
    default:
      return { content: toClash(nodes, rules), contentType: 'text/yaml; charset=utf-8' };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
