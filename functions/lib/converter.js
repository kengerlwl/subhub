/**
 * 订阅格式转换器
 * 将解析后的节点对象数组转换为各客户端支持的格式
 */

/**
 * 转换为 Clash/Mihomo YAML 格式
 */
// Protocol types only supported by Mihomo/Meta kernel (not original Clash)
const MIHOMO_ONLY_TYPES = new Set(['hysteria2', 'vless']);

export function toClash(nodes, rules = 'minimal', kernel = 'clash') {
  const filtered = kernel === 'mihomo' ? nodes : nodes.filter(n => !MIHOMO_ONLY_TYPES.has(n.type));
  const proxies = filtered.map(node => nodeToClashProxy(node)).filter(Boolean);

  // Sanitize then deduplicate proxy names — Clash requires final rendered names to be unique
  const nameCount = {};
  for (const proxy of proxies) {
    const base = sanitizeClashName(proxy.name);
    if (nameCount[base] === undefined) {
      nameCount[base] = 0;
      proxy.name = base;
    } else {
      nameCount[base]++;
      proxy.name = `${base}-${nameCount[base]}`;
    }
  }

  const proxyNames = proxies.map(p => p.name);

  const ruleSet = getRuleSet(rules, proxyNames, kernel);

  const config = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    proxies: proxies,
    'proxy-groups': [
      {
        name: 'Proxy',
        type: 'select',
        proxies: ['Auto', 'DIRECT', ...proxyNames],
      },
      {
        name: 'Auto',
        type: 'url-test',
        proxies: proxyNames,
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
      },
    ],
    rules: ruleSet,
  };

  return yamlStringify(config);
}

/**
 * 转换为 V2Ray/V2RayN Base64 格式
 */
export function toV2ray(nodes) {
  const links = nodes.map(n => n.raw).filter(Boolean);
  return btoa(links.join('\n'));
}

/**
 * 转换为 Sing-Box JSON 格式
 */
export function toSingbox(nodes, rules = 'minimal') {
  const outbounds = nodes.map(node => nodeToSingboxOutbound(node)).filter(Boolean);
  const tags = outbounds.map(o => o.tag);

  const config = {
    log: { level: 'info', timestamp: true },
    dns: {
      servers: [
        { tag: 'google', address: 'tls://8.8.8.8' },
        { tag: 'local', address: '223.5.5.5', detour: 'direct' },
      ],
      rules: [
        { geosite: 'cn', server: 'local' },
      ],
      strategy: 'prefer_ipv4',
    },
    inbounds: [
      { type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true, strict_route: true, sniff: true },
    ],
    outbounds: [
      { type: 'selector', tag: 'proxy', outbounds: ['auto', 'direct', ...tags] },
      { type: 'urltest', tag: 'auto', outbounds: tags, url: 'http://www.gstatic.com/generate_204', interval: '3m' },
      ...outbounds,
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
    ],
    route: {
      auto_detect_interface: true,
      final: 'proxy',
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { geosite: 'cn', geoip: 'cn', outbound: 'direct' },
      ],
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * 转换为 Surge 配置格式
 */
export function toSurge(nodes) {
  const proxyLines = nodes.map(node => nodeToSurgeLine(node)).filter(Boolean);
  const proxyNames = nodes.map(n => n.name);

  return `[General]
loglevel = notify
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local

[Proxy]
DIRECT = direct
${proxyLines.join('\n')}

[Proxy Group]
Proxy = select, Auto, DIRECT, ${proxyNames.join(', ')}
Auto = url-test, ${proxyNames.join(', ')}, url=http://www.gstatic.com/generate_204, interval=300

[Rule]
GEOIP,CN,DIRECT
FINAL,Proxy
`;
}

/**
 * 转换为 Shadowrocket Base64 格式（与 V2Ray 相同）
 */
export function toShadowrocket(nodes) {
  return toV2ray(nodes);
}

// ============ 内部转换函数 ============

function nodeToClashProxy(node) {
  switch (node.type) {
    case 'vmess':
      return {
        name: node.name,
        type: 'vmess',
        server: node.server,
        port: node.port,
        uuid: node.uuid,
        alterId: node.alterId,
        cipher: node.cipher || 'auto',
        tls: node.tls,
        'skip-cert-verify': true,
        servername: node.sni || undefined,
        network: node.network,
        'ws-opts': node.network === 'ws' ? { path: node.path, headers: node.host ? { Host: node.host } : undefined } : undefined,
      };
    case 'vless':
      return {
        name: node.name,
        type: 'vless',
        server: node.server,
        port: node.port,
        uuid: node.uuid,
        flow: node.flow || undefined,
        tls: node.tls === 'tls' || node.tls === 'reality',
        'skip-cert-verify': true,
        servername: node.sni || undefined,
        network: node.network,
        'reality-opts': node.tls === 'reality' ? { 'public-key': node.publicKey, 'short-id': node.shortId } : undefined,
        'ws-opts': node.network === 'ws' ? { path: node.path, headers: node.host ? { Host: node.host } : undefined } : undefined,
        'grpc-opts': node.network === 'grpc' ? { 'grpc-service-name': node.serviceName } : undefined,
        'client-fingerprint': node.fingerprint || undefined,
      };
    case 'trojan':
      return {
        name: node.name,
        type: 'trojan',
        server: node.server,
        port: node.port,
        password: node.password,
        sni: node.sni,
        'skip-cert-verify': true,
        network: node.network !== 'tcp' ? node.network : undefined,
        'ws-opts': node.network === 'ws' ? { path: node.path, headers: node.host ? { Host: node.host } : undefined } : undefined,
      };
    case 'ss':
      return {
        name: node.name,
        type: 'ss',
        server: node.server,
        port: node.port,
        cipher: node.method,
        password: node.password,
      };
    case 'ssr':
      return {
        name: node.name,
        type: 'ssr',
        server: node.server,
        port: node.port,
        cipher: node.method,
        password: node.password,
        protocol: node.protocol,
        obfs: node.obfs,
      };
    case 'hysteria2':
      return {
        name: node.name,
        type: 'hysteria2',
        server: node.server,
        port: node.port,
        password: node.password,
        sni: node.sni,
        'skip-cert-verify': node.insecure || true,
        obfs: node.obfs || undefined,
        'obfs-password': node.obfsPassword || undefined,
      };
    default:
      return null;
  }
}

function nodeToSingboxOutbound(node) {
  const base = { tag: node.name, server: node.server, server_port: node.port };

  switch (node.type) {
    case 'vmess':
      return {
        ...base,
        type: 'vmess',
        uuid: node.uuid,
        alter_id: node.alterId,
        security: node.cipher || 'auto',
        tls: node.tls ? { enabled: true, server_name: node.sni, insecure: true } : undefined,
        transport: node.network === 'ws' ? { type: 'ws', path: node.path, headers: node.host ? { Host: node.host } : undefined } : undefined,
      };
    case 'vless':
      return {
        ...base,
        type: 'vless',
        uuid: node.uuid,
        flow: node.flow || undefined,
        tls: (node.tls === 'tls' || node.tls === 'reality') ? {
          enabled: true,
          server_name: node.sni,
          insecure: true,
          reality: node.tls === 'reality' ? { enabled: true, public_key: node.publicKey, short_id: node.shortId } : undefined,
          utls: node.fingerprint ? { enabled: true, fingerprint: node.fingerprint } : undefined,
        } : undefined,
        transport: node.network === 'ws' ? { type: 'ws', path: node.path, headers: node.host ? { Host: node.host } : undefined } :
                   node.network === 'grpc' ? { type: 'grpc', service_name: node.serviceName } : undefined,
      };
    case 'trojan':
      return {
        ...base,
        type: 'trojan',
        password: node.password,
        tls: { enabled: true, server_name: node.sni, insecure: true },
        transport: node.network === 'ws' ? { type: 'ws', path: node.path } : undefined,
      };
    case 'ss':
      return {
        ...base,
        type: 'shadowsocks',
        method: node.method,
        password: node.password,
      };
    case 'hysteria2':
      return {
        ...base,
        type: 'hysteria2',
        password: node.password,
        tls: { enabled: true, server_name: node.sni, insecure: node.insecure || true },
        obfs: node.obfs ? { type: node.obfs, password: node.obfsPassword } : undefined,
      };
    default:
      return null;
  }
}

function nodeToSurgeLine(node) {
  switch (node.type) {
    case 'vmess':
      return `${node.name} = vmess, ${node.server}, ${node.port}, username=${node.uuid}, tls=${node.tls}, ws=${node.network === 'ws'}, ws-path=${node.path || '/'}`;
    case 'trojan':
      return `${node.name} = trojan, ${node.server}, ${node.port}, password=${node.password}, sni=${node.sni}`;
    case 'ss':
      return `${node.name} = ss, ${node.server}, ${node.port}, encrypt-method=${node.method}, password=${node.password}`;
    case 'hysteria2':
      return `${node.name} = hysteria2, ${node.server}, ${node.port}, password=${node.password}, sni=${node.sni}`;
    default:
      return null;
  }
}

function getRuleSet(type, proxyNames, kernel = 'clash') {
  const proxy = 'Proxy';
  if (type === 'none') {
    return [`MATCH,${proxy}`];
  }

  if (kernel === 'mihomo') {
    return [
      'GEOIP,LAN,DIRECT',
      'GEOSITE,cn,DIRECT',
      'GEOIP,CN,DIRECT',
      `MATCH,${proxy}`,
    ];
  }

  // Default clash-compatible rules: avoid GEOSITE and other Meta-only rule types.
  return [
    'GEOIP,LAN,DIRECT',
    `MATCH,${proxy}`,
  ];
}

/**
 * 简易 YAML 序列化（不依赖外部库）
 */
function yamlStringify(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item).filter(([, v]) => v !== undefined && v !== null);
        if (entries.length > 0) {
          const [firstKey, firstVal] = entries[0];
          result += `${pad}- ${firstKey}: ${yamlValue(firstVal)}\n`;
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            if (typeof v === 'object' && v !== null) {
              result += `${pad}  ${k}:\n${yamlStringify(v, indent + 4)}`;
            } else {
              result += `${pad}  ${k}: ${yamlValue(v)}\n`;
            }
          }
        }
      } else {
        result += `${pad}- ${yamlValue(item)}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'object') {
        result += `${pad}${key}:\n${yamlStringify(value, indent + 2)}`;
      } else {
        result += `${pad}${key}: ${yamlValue(value)}\n`;
      }
    }
  }

  return result;
}

function yamlValue(v) {
  if (typeof v === 'string') {
    const s = sanitizeClashName(v);
    if (s === '' || s === 'true' || s === 'false' || /[:{}\[\],&*?|>!%#@`]/.test(s) || /^\d+$/.test(s)) {
      return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return s;
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return String(v);
}

function sanitizeClashName(v) {
  const ascii = String(v).replace(/[^\x20-\x7E]/g, '').trim();
  const cleaned = ascii || String(v).replace(/[^\x20-\x7E]/g, '_').trim();
  return cleaned || 'proxy';
}
