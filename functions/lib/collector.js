/**
 * 节点采集器
 * 从 GitHub 公开仓库采集已检测过的免费节点
 */

import { parseSubscription } from './parser.js';

// 采集源列表（GitHub raw 文件，这些项目本身会做节点检测筛选）
const SOURCES = [
  {
    name: 'automergepublicnodes',
    url: 'https://raw.githubusercontent.com/FLAVOR-FLAVOR/automergepublicnodes/main/list.txt',
    type: 'base64',
  },
  {
    name: 'mahdibland-v2ray',
    url: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge_base64.txt',
    type: 'base64',
  },
  {
    name: 'barry-far-v2ray',
    url: 'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub_Merge_Base64.txt',
    type: 'base64',
  },
  {
    name: 'mfuu-v2ray',
    url: 'https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray',
    type: 'base64',
  },
  {
    name: 'peasoft-nofreenodes',
    url: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
    type: 'plain',
  },
];

/**
 * 从所有源采集节点
 * @returns {Array} 去重后的节点数组
 */
export async function collectNodes() {
  const allNodes = [];
  const errors = [];

  // 并发采集所有源
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      try {
        const resp = await fetch(source.url, {
          headers: { 'User-Agent': 'SubHub/1.0' },
          cf: { cacheTtl: 300 }, // 缓存 5 分钟
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const text = await resp.text();
        const nodes = parseSubscription(text);
        return { source: source.name, nodes, count: nodes.length };
      } catch (e) {
        errors.push({ source: source.name, error: e.message });
        return { source: source.name, nodes: [], count: 0 };
      }
    })
  );

  // 汇总所有节点
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.nodes.length > 0) {
      allNodes.push(...result.value.nodes);
    }
  }

  // 去重（按 server:port:type 去重）
  const seen = new Set();
  const uniqueNodes = [];
  for (const node of allNodes) {
    const key = `${node.type}:${node.server}:${node.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueNodes.push(node);
    }
  }

  // 标记地区（简易 IP → 国家映射，基于节点名称中的关键词）
  for (const node of uniqueNodes) {
    node.country = guessCountry(node);
  }

  const stats = {
    totalCollected: allNodes.length,
    uniqueCount: uniqueNodes.length,
    sources: results.map(r => r.status === 'fulfilled' ? r.value : { source: 'unknown', count: 0 }),
    errors,
    updatedAt: new Date().toISOString(),
  };

  return { nodes: uniqueNodes, stats };
}

/**
 * 根据节点名称猜测国家/地区
 */
function guessCountry(node) {
  const name = (node.name || '').toUpperCase();
  const server = (node.server || '').toLowerCase();

  const patterns = [
    { codes: ['US', 'USA', '美国', 'UNITED STATES', 'AMERICA', 'LOS ANGELES', 'SAN JOSE', 'SEATTLE', 'DALLAS', 'CHICAGO', 'NEW YORK', 'MIAMI', 'WASHINGTON'], country: 'US' },
    { codes: ['JP', 'JAPAN', '日本', 'TOKYO', 'OSAKA'], country: 'JP' },
    { codes: ['HK', 'HONG KONG', '香港'], country: 'HK' },
    { codes: ['SG', 'SINGAPORE', '新加坡'], country: 'SG' },
    { codes: ['TW', 'TAIWAN', '台湾', '台灣'], country: 'TW' },
    { codes: ['KR', 'KOREA', '韩国', '韓國', 'SEOUL'], country: 'KR' },
    { codes: ['DE', 'GERMANY', '德国', 'FRANKFURT'], country: 'DE' },
    { codes: ['GB', 'UK', 'UNITED KINGDOM', '英国', 'LONDON'], country: 'GB' },
    { codes: ['FR', 'FRANCE', '法国', 'PARIS'], country: 'FR' },
    { codes: ['CA', 'CANADA', '加拿大', 'TORONTO', 'VANCOUVER'], country: 'CA' },
    { codes: ['AU', 'AUSTRALIA', '澳大利亚', 'SYDNEY'], country: 'AU' },
    { codes: ['IN', 'INDIA', '印度', 'MUMBAI'], country: 'IN' },
    { codes: ['RU', 'RUSSIA', '俄罗斯', 'MOSCOW'], country: 'RU' },
    { codes: ['NL', 'NETHERLANDS', '荷兰', 'AMSTERDAM'], country: 'NL' },
    { codes: ['TR', 'TURKEY', '土耳其', 'ISTANBUL'], country: 'TR' },
  ];

  for (const { codes, country } of patterns) {
    for (const code of codes) {
      if (name.includes(code) || server.includes(code.toLowerCase())) {
        return country;
      }
    }
  }

  return 'UN'; // Unknown
}

/**
 * 国家代码 → emoji 旗帜
 */
export function countryFlag(code) {
  const flags = {
    US: '🇺🇸', JP: '🇯🇵', HK: '🇭🇰', SG: '🇸🇬', TW: '🇹🇼', KR: '🇰🇷',
    DE: '🇩🇪', GB: '🇬🇧', FR: '🇫🇷', CA: '🇨🇦', AU: '🇦🇺', IN: '🇮🇳',
    RU: '🇷🇺', NL: '🇳🇱', TR: '🇹🇷', UN: '🏳️',
  };
  return flags[code] || '🏳️';
}
