/**
 * GET /api/collect - 手动触发节点采集（也可由 Cron 调用）
 * 生产环境中可通过 Cloudflare Cron Trigger 或外部 cron 服务定时调用此接口
 */

import { collectNodes } from '../lib/collector.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { nodes, stats } = await collectNodes();

    // 写入 KV
    await env.SUBHUB_KV.put('nodes:latest', JSON.stringify({ nodes, stats }), {
      expirationTtl: 7200, // 2 小时过期（如果采集失败，旧数据最多保留 2 小时）
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Collected ${stats.uniqueCount} unique nodes from ${stats.sources.length} sources`,
      stats,
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
