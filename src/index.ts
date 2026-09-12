import { Hono } from 'hono';

export interface Env {
	SentinelKV: KVNamespace;
	SentinelD1: D1Database;
	SentinelDO: DurableObjectNamespace;
}

export class SentinelSessionDO {
	state: DurableObjectState;
	env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/status') {
			let count: number = (await this.state.storage.get('count')) || 0;
			return Response.json({ activeSessions: count });
		}
		return new Response('Sentinel DO Active', { status: 200 });
	}
}

const app = new Hono<{ Bindings: Env }>();

// Helper para gerar Hash SHA-512 da senha
async function hashPassword(password: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// PAINEL DE CONTROLE (Tailwind + FontAwesome + SweetAlert2)
// ==========================================
app.get('/', (c) => {
	const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sentinel Cloud - Painel de Controle</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- SweetAlert2 -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
    <!-- Navbar -->
    <nav class="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="bg-indigo-600 p-2 rounded-lg text-white">
                    <i class="fa-solid fa-shield-halved text-xl"></i>
                </div>
                <span class="text-xl font-bold tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Sentinel Cloud</span>
            </div>
            <div class="flex items-center space-x-4">
                <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <i class="fa-solid fa-circle text-[8px] mr-1"></i> Edge Operational
                </span>
            </div>
        </div>
    </nav>

    <!-- Main Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <!-- Header Grid: Auth & Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Criar Conta -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 text-slate-700 text-4xl">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <h2 class="text-lg font-semibold mb-4 text-indigo-400"><i class="fa-solid fa-user-shield mr-2"></i>Criar Conta (D1 + SHA-512)</h2>
                <form id="registerForm" class="space-y-4">
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Username</label>
                        <input type="text" id="regUser" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    </div>
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Password</label>
                        <input type="password" id="regPass" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-sm transition shadow-lg shadow-indigo-600/20">
                        Registrar Usuário
                    </button>
                </form>
            </div>

            <!-- Criar Arquivo / Pasta na CDN -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden md:col-span-2">
                <div class="absolute top-0 right-0 p-4 text-slate-700 text-4xl">
                    <i class="fa-solid fa-folder-tree"></i>
                </div>
                <h2 class="text-lg font-semibold mb-4 text-cyan-400"><i class="fa-solid fa-cloud-arrow-up mr-2"></i>Gerenciador de CDN (SentinelKV)</h2>
                <form id="uploadForm" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Caminho / Pasta / Arquivo</label>
                        <input type="text" id="filePath" placeholder="ex: css/style.css ou index.html" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500">
                    </div>
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">MIME Type</label>
                        <select id="fileMime" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500">
                            <option value="text/html">text/html</option>
                            <option value="text/css">text/css</option>
                            <option value="application/javascript">application/javascript</option>
                            <option value="application/json">application/json</option>
                            <option value="image/png">image/png</option>
                            <option value="image/jpeg">image/jpeg</option>
                            <option value="text/plain">text/plain</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Conteúdo do Arquivo</label>
                        <textarea id="fileContent" rows="3" placeholder="Cole o código HTML, CSS ou texto aqui..." required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 font-mono"></textarea>
                    </div>
                    <div class="sm:col-span-2">
                        <button type="submit" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg text-sm transition shadow-lg shadow-cyan-600/20">
                            Publicar na CDN
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Seção: Hospedar Página UUID (Apenas text/html) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 class="text-lg font-semibold mb-4 text-emerald-400"><i class="fa-solid fa-globe mr-2"></i>Criar Nova CDN Page (Hospedagem Dedicada)</h2>
            <form id="hostForm" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Selecione Arquivo HTML (Mime text/html)</label>
                    <select id="htmlFileSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                        <option value="">Carregando arquivos HTML...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1">Título da Página / Identificador</label>
                    <input type="text" id="pageTitle" placeholder="Minha Landing Page" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                </div>
                <div>
                    <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm transition shadow-lg shadow-emerald-600/20">
                        Criar e Hospedar Página
                    </button>
                </div>
            </form>
        </div>

        <!-- Tabelas de Inventário -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Arquivos na CDN -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold text-slate-200"><i class="fa-solid fa-folder-open text-amber-400 mr-2"></i>Arquivos na CDN</h3>
                    <button onclick="loadCdnFiles()" class="text-xs text-slate-400 hover:text-white"><i class="fa-solid fa-rotate"></i> Atualizar</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-950 text-slate-400 uppercase text-[10px]">
                            <tr>
                                <th class="p-3">Caminho</th>
                                <th class="p-3">MIME Type</th>
                                <th class="p-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="cdnFilesTable" class="divide-y divide-slate-800 text-slate-300">
                            <tr><td colspan="3" class="p-4 text-center text-slate-500">Nenhum arquivo carregado.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Páginas Hospedadas (UUID) -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold text-slate-200"><i class="fa-solid fa-link text-indigo-400 mr-2"></i>Páginas Hospedadas (UUID)</h3>
                    <button onclick="loadHostedPages()" class="text-xs text-slate-400 hover:text-white"><i class="fa-solid fa-rotate"></i> Atualizar</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-950 text-slate-400 uppercase text-[10px]">
                            <tr>
                                <th class="p-3">Título</th>
                                <th class="p-3">URL UUID</th>
                                <th class="p-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="hostedPagesTable" class="divide-y divide-slate-800 text-slate-300">
                            <tr><td colspan="3" class="p-4 text-center text-slate-500">Nenhuma página hospedada.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    </main>

    <!-- Scripts de Interação -->
    <script>
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUser').value;
            const password = document.getElementById('regPass').value;

            try {
                const res = await fetch('/api/v1/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Sucesso!', 'Conta criada com hash SHA-512 no D1!', 'success');
                    document.getElementById('registerForm').reset();
                } else {
                    Swal.fire('Erro', data.error || 'Erro ao registrar', 'error');
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha na conexão com a Edge', 'error');
            }
        });

        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const path = document.getElementById('filePath').value;
            const mimeType = document.getElementById('fileMime').value;
            const content = document.getElementById('fileContent').value;

            try {
                const res = await fetch('/api/v1/cdn/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, mimeType, content })
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Sucesso!', 'Arquivo publicado na CDN!', 'success');
                    document.getElementById('uploadForm').reset();
                    loadCdnFiles();
                } else {
                    Swal.fire('Erro', data.error || 'Erro no upload', 'error');
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha no upload', 'error');
            }
        });

        async function loadCdnFiles() {
            try {
                const res = await fetch('/api/v1/cdn/list');
                const data = await res.json();
                const tbody = document.getElementById('cdnFilesTable');
                const htmlSelect = document.getElementById('htmlFileSelect');
                
                tbody.innerHTML = '';
                htmlSelect.innerHTML = '<option value="">Selecione um arquivo .html</option>';

                if (!data.files || data.files.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-500">Nenhum arquivo encontrado.</td></tr>';
                    return;
                }

                data.files.forEach(file => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td class="p-3 font-mono text-cyan-400">\${file.path}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700">\${file.mimeType}</span></td>
                        <td class="p-3">
                            <a href="/cdn/\${file.path}" target="_blank" class="text-indigo-400 hover:underline mr-3"><i class="fa-solid fa-eye"></i></a>
                            <button onclick="deleteFile('\${file.path}')" class="text-red-400 hover:underline"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    \`;
                    tbody.appendChild(tr);

                    if (file.mimeType === 'text/html') {
                        const opt = document.createElement('option');
                        opt.value = file.path;
                        opt.textContent = file.path;
                        htmlSelect.appendChild(opt);
                    }
                });
            } catch (err) {
                console.error('Erro ao carregar arquivos CDN', err);
            }
        }

        async function deleteFile(path) {
            const confirm = await Swal.fire({
                title: 'Tem certeza?',
                text: \`Deseja remover \${path} da CDN?\`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Sim, deletar'
            });

            if (confirm.isConfirmed) {
                const res = await fetch('/api/v1/cdn/file', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                if (res.ok) {
                    Swal.fire('Deletado!', 'Arquivo removido.', 'success');
                    loadCdnFiles();
                    loadHostedPages();
                } else {
                    Swal.fire('Erro', 'Não foi possível deletar', 'error');
                }
            }
        }

        document.getElementById('hostForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const htmlPath = document.getElementById('htmlFileSelect').value;
            const title = document.getElementById('pageTitle').value;

            if (!htmlPath) {
                Swal.fire('Atenção', 'Selecione um arquivo HTML válido da CDN.', 'warning');
                return;
            }

            try {
                const res = await fetch('/api/v1/pages/host', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ htmlPath, title })
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Sucesso!', \`Página hospedada com UUID: \${data.uuid}\`, 'success');
                    document.getElementById('hostForm').reset();
                    loadHostedPages();
                } else {
                    Swal.fire('Erro', data.error || 'Erro ao hospedar página', 'error');
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha ao hospedar página', 'error');
            }
        });

        async function loadHostedPages() {
            try {
                const res = await fetch('/api/v1/pages/list');
                const data = await res.json();
                const tbody = document.getElementById('hostedPagesTable');
                
                tbody.innerHTML = '';
                if (!data.pages || data.pages.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-500">Nenhuma página hospedada.</td></tr>';
                    return;
                }

                data.pages.forEach(page => {
                    const tr = document.createElement('tr');
                    const pageUrl = \`/page/\${page.uuid}\`;
                    tr.innerHTML = \`
                        <td class="p-3 font-semibold text-slate-200">\${page.title}</td>
                        <td class="p-3 font-mono text-xs text-emerald-400"><a href="\${pageUrl}" target="_blank" class="hover:underline">\${page.uuid} <i class="fa-solid fa-external-link-alt ml-1"></i></a></td>
                        <td class="p-3">
                            <button onclick="deletePage('\${page.uuid}')" class="text-red-400 hover:underline"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    \`;
                    tbody.appendChild(tr);
                });
            } catch (err) {
                console.error('Erro ao carregar páginas', err);
            }
        }

        async function deletePage(uuid) {
            const res = await fetch(\`/api/v1/pages/\${uuid}\`, { method: 'DELETE' });
            if (res.ok) {
                Swal.fire('Removido', 'Página desativada.', 'success');
                loadHostedPages();
            }
        }

        loadCdnFiles();
        loadHostedPages();
    </script>
</body>
</html>`;

	return c.html(html);
});

// ==========================================
// API DE AUTENTICAÇÃO (D1 + SHA-512)
// ==========================================
app.post('/api/v1/auth/register', async (c) => {
	try {
		const { username, password } = await c.req.json<{ username: string; password: string }>();
		if (!username || !password) return c.json({ error: 'Username e password obrigatórios' }, 400);

		await c.env.SentinelD1.prepare(
			`CREATE TABLE IF NOT EXISTS sentinel_users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT UNIQUE,
				password_hash TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`
		).run();

		const passwordHash = await hashPassword(password);

		await c.env.SentinelD1.prepare('INSERT INTO sentinel_users (username, password_hash) VALUES (?, ?)')
			.bind(username, passwordHash)
			.run();

		return c.json({ status: 'success', username, message: 'Usuário cadastrado com SHA-512' });
	} catch (err: any) {
		return c.json({ error: err.message.includes('UNIQUE') ? 'Usuário já existe' : err.message }, 500);
	}
});

// ==========================================
// API DE CDN (SentinelKV) - Pastas, Arquivos, MIME Types
// ==========================================
interface CDNFileMeta {
	path: string;
	mimeType: string;
	size: number;
	createdAt: string;
}

app.post('/api/v1/cdn/upload', async (c) => {
	try {
		const body = await c.req.json<{ path: string; content: string; mimeType: string }>();
		if (!body.path || !body.content || !body.mimeType) {
			return c.json({ error: 'Campos obrigatórios faltando' }, 400);
		}

		const cleanPath = body.path.startsWith('/') ? body.path.slice(1) : body.path;
		const metaKey = `meta:${cleanPath}`;
		const contentKey = `file:${cleanPath}`;

		const meta: CDNFileMeta = {
			path: cleanPath,
			mimeType: body.mimeType,
			size: body.content.length,
			createdAt: new Date().toISOString()
		};

		await c.env.SentinelKV.put(contentKey, body.content);
		await c.env.SentinelKV.put(metaKey, JSON.stringify(meta));

		const indexStr = await c.env.SentinelKV.get('cdn:index');
		const index: string[] = indexStr ? JSON.parse(indexStr) : [];
		if (!index.includes(cleanPath)) {
			index.push(cleanPath);
			await c.env.SentinelKV.put('cdn:index', JSON.stringify(index));
		}

		return c.json({ status: 'success', path: cleanPath, meta });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

app.get('/api/v1/cdn/list', async (c) => {
	const indexStr = await c.env.SentinelKV.get('cdn:index');
	const index: string[] = indexStr ? JSON.parse(indexStr) : [];
	
	const files = [];
	for (const path of index) {
		const metaStr = await c.env.SentinelKV.get(`meta:${path}`);
		if (metaStr) files.push(JSON.parse(metaStr));
	}

	return c.json({ files });
});

app.get('/cdn/*', async (c) => {
	const filePath = new URL(c.req.url).pathname.replace('/cdn/', '');
	const [content, metaStr] = await Promise.all([
		c.env.SentinelKV.get(`file:${filePath}`),
		c.env.SentinelKV.get(`meta:${filePath}`)
	]);

	if (!content || !metaStr) return c.json({ error: 'Arquivo não encontrado' }, 404);
	const meta: CDNFileMeta = JSON.parse(metaStr);

	return new Response(content, {
		headers: {
			'Content-Type': meta.mimeType,
			'Cache-Control': 'public, max-age=31536000'
		}
	});
});

app.delete('/api/v1/cdn/file', async (c) => {
	const { path } = await c.req.json<{ path: string }>();
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	
	await c.env.SentinelKV.delete(`file:${cleanPath}`);
	await c.env.SentinelKV.delete(`meta:${cleanPath}`);

	const indexStr = await c.env.SentinelKV.get('cdn:index');
	if (indexStr) {
		let index: string[] = JSON.parse(indexStr);
		index = index.filter(p => p !== cleanPath);
		await c.env.SentinelKV.put('cdn:index', JSON.stringify(index));
	}

	return c.json({ status: 'success' });
});

// ==========================================
// API DE HOSPEDAGEM DE PÁGINAS (UUID + CDN text/html)
// ==========================================
app.post('/api/v1/pages/host', async (c) => {
	try {
		const { htmlPath, title } = await c.req.json<{ htmlPath: string; title: string }>();
		if (!htmlPath || !title) return c.json({ error: 'Caminho HTML e Título são obrigatórios' }, 400);

		const metaStr = await c.env.SentinelKV.get(`meta:${htmlPath}`);
		if (!metaStr) return c.json({ error: 'Arquivo não encontrado na CDN' }, 404);
		const meta: CDNFileMeta = JSON.parse(metaStr);
		if (meta.mimeType !== 'text/html') {
			return c.json({ error: 'Apenas arquivos com MIME Type text/html podem ser hospedados como página' }, 400);
		}

		const uuid = crypto.randomUUID();
		const pageData = { uuid, title, htmlPath, createdAt: new Date().toISOString() };

		await c.env.SentinelKV.put(`page:${uuid}`, JSON.stringify(pageData));

		const pagesIndexStr = await c.env.SentinelKV.get('pages:index');
		const pagesIndex: string[] = pagesIndexStr ? JSON.parse(pagesIndexStr) : [];
		pagesIndex.push(uuid);
		await c.env.SentinelKV.put('pages:index', JSON.stringify(pagesIndex));

		return c.json({ status: 'success', uuid, url: `/page/${uuid}` });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

app.get('/api/v1/pages/list', async (c) => {
	const indexStr = await c.env.SentinelKV.get('pages:index');
	const index: string[] = indexStr ? JSON.parse(indexStr) : [];
	
	const pages = [];
	for (const uuid of index) {
		const pageStr = await c.env.SentinelKV.get(`page:${uuid}`);
		if (pageStr) pages.push(JSON.parse(pageStr));
	}

	return c.json({ pages });
});

app.get('/page/:uuid', async (c) => {
	const uuid = c.req.param('uuid');
	const pageStr = await c.env.SentinelKV.get(`page:${uuid}`);
	if (!pageStr) return c.text('Página não encontrada ou desativada', 404);

	const pageData = JSON.parse(pageStr);
	const htmlContent = await c.env.SentinelKV.get(`file:${pageData.htmlPath}`);
	if (!htmlContent) return c.text('Arquivo HTML associado não encontrado na CDN', 404);

	return new Response(htmlContent, {
		headers: { 'Content-Type': 'text/html' }
	});
});

app.delete('/api/v1/pages/:uuid', async (c) => {
	const uuid = c.req.param('uuid');
	await c.env.SentinelKV.delete(`page:${uuid}`);
	
	const indexStr = await c.env.SentinelKV.get('pages:index');
	if (indexStr) {
		let index: string[] = JSON.parse(indexStr);
		index = index.filter(u => u !== uuid);
		await c.env.SentinelKV.put('pages:index', JSON.stringify(index));
	}

	return c.json({ status: 'success' });
});

export default {
	fetch: app.fetch,
};
