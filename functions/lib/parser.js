/**
 * 节点协议解析器
 * 支持解析 vmess://, vless://, trojan://, ss://, ssr://, hysteria2:// 链接
 */

/**
 * 解析 Base64 编码的订阅内容或明文节点链接列表
 * @param {string} content - Base64 或明文内容
 * @returns {Array} 解析后的节点对象数组
 */
export function parseSubscription(content) {
  let text = content.trim();

  // 尝试 Base64 解码
  try {
    const decoded = atob(text);
    if (decoded.includes('://')) {
      text = decoded;
    }
  } catch (e) {
    // 不是 Base64，当作明文处理
  }

  const lines = text.split(/[\r\n]+/).filter(l => l.trim());
  const nodes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    try {
      let node = null;
      if (trimmed.startsWith('vmess://')) {
        node = parseVmess(trimmed);
      } else if (trimmed.startsWith('vless://')) {
        node = parseVless(trimmed);
      } else if (trimmed.startsWith('trojan://')) {
        node = parseTrojan(trimmed);
      } else if (trimmed.startsWith('ss://') && !trimmed.startsWith('ssr://')) {
        node = parseSS(trimmed);
      } else if (trimmed.startsWith('ssr://')) {
        node = parseSSR(trimmed);
      } else if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) {
        node = parseHysteria2(trimmed);
      }
      if (node && node.server && node.port) {
        nodes.push(node);
      }
    } catch (e) {
      // 跳过解析失败的行
    }
  }

  return nodes;
}

/**
 * 解析 vmess:// 链接（V2RayN 格式，Base64 JSON）
 */
function parseVmess(link) {
  const raw = link.replace('vmess://', '');
  const json = JSON.parse(atob(raw));
  return {
    type: 'vmess',
    name: json.ps || `VMess-${json.add}`,
    server: json.add,
    port: parseInt(json.port),
    uuid: json.id,
    alterId: parseInt(json.aid || 0),
    cipher: json.scy || 'auto',
    network: json.net || 'tcp',
    tls: json.tls === 'tls',
    sni: json.sni || json.host || '',
    host: json.host || '',
    path: json.path || '',
    raw: link,
  };
}

/**
 * 解析 vless:// 链接
 * 格式: vless://uuid@server:port?params#name
 */
function parseVless(link) {
  const url = new URL(link);
  const params = url.searchParams;
  return {
    type: 'vless',
    name: decodeURIComponent(url.hash.slice(1)) || `VLESS-${url.hostname}`,
    server: url.hostname,
    port: parseInt(url.port),
    uuid: url.username,
    flow: params.get('flow') || '',
    network: params.get('type') || 'tcp',
    tls: params.get('security') || '',
    sni: params.get('sni') || '',
    fingerprint: params.get('fp') || '',
    publicKey: params.get('pbk') || '',
    shortId: params.get('sid') || '',
    host: params.get('host') || '',
    path: params.get('path') || '',
    serviceName: params.get('serviceName') || '',
    raw: link,
  };
}

/**
 * 解析 trojan:// 链接
 * 格式: trojan://password@server:port?params#name
 */
function parseTrojan(link) {
  const url = new URL(link);
  const params = url.searchParams;
  return {
    type: 'trojan',
    name: decodeURIComponent(url.hash.slice(1)) || `Trojan-${url.hostname}`,
    server: url.hostname,
    port: parseInt(url.port),
    password: decodeURIComponent(url.username),
    network: params.get('type') || 'tcp',
    tls: true,
    sni: params.get('sni') || url.hostname,
    fingerprint: params.get('fp') || '',
    host: params.get('host') || '',
    path: params.get('path') || '',
    raw: link,
  };
}

/**
 * 解析 ss:// 链接
 * 格式1: ss://base64(method:password)@server:port#name
 * 格式2: ss://base64(method:password@server:port)#name
 */
function parseSS(link) {
  let name = '';
  let mainPart = link.replace('ss://', '');

  // 提取 fragment（名称）
  const hashIdx = mainPart.lastIndexOf('#');
  if (hashIdx !== -1) {
    name = decodeURIComponent(mainPart.slice(hashIdx + 1));
    mainPart = mainPart.slice(0, hashIdx);
  }

  let method, password, server, port;

  if (mainPart.includes('@')) {
    // 格式1: base64(method:password)@server:port
    const atIdx = mainPart.lastIndexOf('@');
    const userInfo = mainPart.slice(0, atIdx);
    const serverInfo = mainPart.slice(atIdx + 1);
    const decoded = safeAtob(userInfo);
    const colonIdx = decoded.indexOf(':');
    method = decoded.slice(0, colonIdx);
    password = decoded.slice(colonIdx + 1);
    const lastColon = serverInfo.lastIndexOf(':');
    server = serverInfo.slice(0, lastColon);
    port = parseInt(serverInfo.slice(lastColon + 1));
  } else {
    // 格式2: base64(method:password@server:port)
    const decoded = safeAtob(mainPart);
    const atIdx = decoded.lastIndexOf('@');
    const userPart = decoded.slice(0, atIdx);
    const serverPart = decoded.slice(atIdx + 1);
    const colonIdx = userPart.indexOf(':');
    method = userPart.slice(0, colonIdx);
    password = userPart.slice(colonIdx + 1);
    const lastColon = serverPart.lastIndexOf(':');
    server = serverPart.slice(0, lastColon);
    port = parseInt(serverPart.slice(lastColon + 1));
  }

  return {
    type: 'ss',
    name: name || `SS-${server}`,
    server,
    port,
    method,
    password,
    raw: link,
  };
}

/**
 * 解析 ssr:// 链接
 * 格式: ssr://base64(server:port:protocol:method:obfs:base64pass/?params)
 */
function parseSSR(link) {
  const decoded = safeAtob(link.replace('ssr://', ''));
  const qIdx = decoded.indexOf('/?');
  const mainStr = qIdx !== -1 ? decoded.slice(0, qIdx) : decoded;
  const paramStr = qIdx !== -1 ? decoded.slice(qIdx + 2) : '';

  // server:port:protocol:method:obfs:base64pass
  // server 可能包含 IPv6，需要从右往左拆
  const parts = mainStr.split(':');
  const password = safeAtob(parts.pop());
  const obfs = parts.pop();
  const method = parts.pop();
  const protocol = parts.pop();
  const port = parseInt(parts.pop());
  const server = parts.join(':'); // 剩余部分是 server（兼容 IPv6）

  let name = `SSR-${server}`;
  if (paramStr) {
    const params = new URLSearchParams(paramStr);
    const remarks = params.get('remarks');
    if (remarks) name = safeAtob(remarks);
  }

  return {
    type: 'ssr',
    name,
    server,
    port,
    method,
    password,
    protocol,
    obfs,
    raw: link,
  };
}

/**
 * 解析 hysteria2:// 链接
 * 格式: hysteria2://password@server:port?params#name
 */
function parseHysteria2(link) {
  const normalized = link.replace('hy2://', 'hysteria2://');
  const url = new URL(normalized);
  const params = url.searchParams;
  return {
    type: 'hysteria2',
    name: decodeURIComponent(url.hash.slice(1)) || `Hy2-${url.hostname}`,
    server: url.hostname,
    port: parseInt(url.port),
    password: decodeURIComponent(url.username),
    sni: params.get('sni') || url.hostname,
    insecure: params.get('insecure') === '1',
    obfs: params.get('obfs') || '',
    obfsPassword: params.get('obfs-password') || '',
    raw: link,
  };
}

/**
 * 安全的 Base64 解码（处理 URL-safe Base64）
 */
function safeAtob(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}
