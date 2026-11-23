// Cloudflare Pages Function —— 社区媒体的 GitHub 上传代理
// 路径：POST /api/upload?name=chat_1699999999999.mp4
// 需要在 Cloudflare Pages 项目里配置环境变量 GH_TOKEN（仓库写入权限的令牌）
// 可选：GH_OWNER / GH_REPO / GH_DIR（默认 fukoaurora0822-star / fuko-world / fumi）

const DEFAULTS = { owner: 'fukoaurora0822-star', repo: 'fuko-world', dir: 'fumi' };
const MAX_BYTES = 24 * 1024 * 1024;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

export async function onRequestPost({ request, env }) {
  const token = env.GH_TOKEN;
  if (!token) return json({ error: 'GH_TOKEN 未配置：去 Cloudflare Pages 设置里加上这个环境变量' }, 500);

  const url = new URL(request.url);
  const raw = (url.searchParams.get('name') || '').replace(/[^\w.\-]/g, '');
  if (!raw) return json({ error: '缺少文件名' }, 400);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: '空文件' }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: '文件超过 24MB' }, 413);

  const owner = env.GH_OWNER || DEFAULTS.owner;
  const repo = env.GH_REPO || DEFAULTS.repo;
  const dir = env.GH_DIR || DEFAULTS.dir;
  const path = dir + '/' + raw;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'fuko-community-upload'
    },
    body: JSON.stringify({ message: `community upload ${raw}`, content: toBase64(body) })
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('GitHub upload failed', res.status, detail);
    return json({ error: 'GitHub 上传失败 HTTP ' + res.status }, 502);
  }
  return json({ path });
}
