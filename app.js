const $ = (s) => document.querySelector(s);
const results = $('#results');

function line(msg, cls = '') {
    const el = document.createElement('div');
    el.className = `mod ${cls}`;
    el.innerHTML = msg;
    results.appendChild(el);
    return el;
}

// --- Utils: slug & URLs ---
function parseSlug(raw) {
    try {
        // Autorise un commentaire après l’URL (séparé par « — », « # », ou espaces multiples)
        const cleaned = raw.split(/\s+—\s+|\s+#\s+|\s{2,}/)[0].trim();
        const justUrl = cleaned.split(/\s+/)[0];
        const u = new URL(justUrl);
        if (!u.hostname.endsWith('modrinth.com')) return null;
        const parts = u.pathname.split('/').filter(Boolean);
        const slugIndex = parts[0] === 'mod' ? 1 : 0;
        return parts[slugIndex] || null;
    } catch {
        return null;
    }
}

function buildDownloadPageURL(slug, version, loader) {
    const base = `https://modrinth.com/mod/${encodeURIComponent(slug)}`;
    const params = new URLSearchParams({ version, loader });
    return `${base}?${params.toString()}#download`;
}

function choosePreferredVersion(versions, channel) {
    if (!Array.isArray(versions) || versions.length === 0) return null;
    const selectedChannel = (channel || '').toLowerCase();
    return (
        versions.find((v) => (v.version_type || '').toLowerCase() === selectedChannel) ||
        versions[0] ||
        null
    );
}

async function fetchMatchingVersion(slug, mcVersion, loader, channel) {
    const qLoaders = encodeURIComponent(JSON.stringify([loader]));
    const qVers = encodeURIComponent(JSON.stringify([mcVersion]));
    const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(
        slug
    )}/version?loaders=${qLoaders}&game_versions=${qVers}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const versions = await res.json();
    return choosePreferredVersion(versions, channel);
}

function pickPrimaryFile(files) {
    if (!files || !files.length) return null;
    return files.find((f) => f.primary) || files[0];
}

function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function clearResults() {
    results.innerHTML = '';
}

function readInputs() {
    const rawLines = $('#mods').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const lines = rawLines.map((l) => {
        const m = l.match(/^(\S+?)(?:\s+—\s+|\s+#\s+|\s{2,})(.+)$/);
        return m ? { url: m[1], comment: m[2] } : { url: l, comment: '' };
    });
    return {
        lines,
        mcVersion: $('#mcVersion').value.trim(),
        loader: $('#loader').value,
        channel: $('#channel').value,
    };
}

async function buildFileList(lines, mcVersion, loader, channel) {
    const fileEntries = [];
    for (const { url: urlRaw, comment } of lines) {
        const slug = parseSlug(urlRaw);
        if (!slug) {
            line(`<b>Entrée invalide</b> : <span class="muted">${urlRaw}</span>`, 'err');
            continue;
        }
        try {
            const ver = await fetchMatchingVersion(slug, mcVersion, loader, channel);
            if (!ver) {
                line(`<b>${slug}</b> <span class="err">Aucune version compatible.</span>`, '');
                continue;
            }
            const f = pickPrimaryFile(ver.files);
            if (!f || !f.url) {
                line(`<b>${slug}</b> <span class="err">Aucun fichier principal trouvé.</span>`, '');
                continue;
            }
            fileEntries.push({
                slug,
                fileName: f.filename || `${slug}.jar`,
                url: f.url,
                note: comment,
            });
        } catch (e) {
            line(`<b>${slug}</b> <span class="err">Erreur: ${e.message}</span>`, '');
        }
    }
    return fileEntries;
}

async function handleBuildLinks() {
    clearResults();
    const { lines, mcVersion, loader } = readInputs();
    if (lines.length === 0) {
        line('Ajoutez au moins un lien Modrinth.', 'err');
        return;
    }
    for (const { url: urlRaw, comment } of lines) {
        const slug = parseSlug(urlRaw);
        if (!slug) {
            line(`<b>Entrée invalide</b> : <span class="muted">${urlRaw}</span>`, 'err');
            continue;
        }
        const href = buildDownloadPageURL(slug, mcVersion, loader);
        line(
            `<b>${slug}</b>${comment ? ` — <span class="muted">${comment}</span>` : ''} → <a href="${href}" target="_blank" rel="noopener">${href}</a>`
        );
    }
}

async function handleZipAll() {
    clearResults();
    const { lines, mcVersion, loader, channel } = readInputs();
    if (lines.length === 0) {
        line('Ajoutez au moins un lien Modrinth.', 'err');
        return;
    }
    if (!window.JSZip) {
        line('JSZip n’a pas été chargé. Vérifiez votre connexion.', 'err');
        return;
    }

    const zip = new JSZip();
    const added = [];
    const summary = line('<b>Préparation du ZIP…</b><div class="status muted">Résolution des versions…</div>');
    const status = summary.querySelector('.status');

    const fileEntries = await buildFileList(lines, mcVersion, loader, channel);
    if (fileEntries.length === 0) {
        status.textContent = 'Aucun fichier à zipper.';
        return;
    }

    let i = 0;
    for (const fe of fileEntries) {
        i++;
        status.textContent = `Téléchargement ${i}/${fileEntries.length} – ${fe.fileName}`;
        try {
            const resp = await fetch(fe.url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const arrayBuf = await blob.arrayBuffer();
            zip.file(fe.fileName, arrayBuf);
            added.push(fe.fileName);
        } catch (e) {
            line(`<span class="err">Échec pour ${fe.fileName} (${e.message})</span>`, '');
        }
    }

    if (added.length === 0) {
        status.textContent = 'Échec: aucun fichier ajouté.';
        return;
    }

    status.textContent = 'Compression…';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const outName = `mods-${mcVersion}-${loader}.zip`;
    const url = URL.createObjectURL(zipBlob);
    triggerDownload(url, outName);
    status.outerHTML = `<div class="status ok">ZIP prêt : <code>${outName}</code> (${added.length} fichiers). Si le téléchargement ne démarre pas, cliquez <a href="${url}" download="${outName}">ici</a>.</div>`;
}

function runTests() {
    const out = [];
    function ok(name) {
        out.push(`✅ ${name}`);
    }
    function err(name, extra = '') {
        out.push(`❌ ${name}${extra ? ' — ' + extra : ''}`);
    }

    // parseSlug
    try {
        const a = parseSlug('https://modrinth.com/mod/fabric-api');
        const b = parseSlug('https://modrinth.com/mod/sodium?version=1.21.8&loader=fabric');
        const c = parseSlug('https://modrinth.com/sodium');
        const d = parseSlug('https://modrinth.com/mod/dynamic-fps — commentaire');
        a === 'fabric-api' ? ok('parseSlug fabric-api') : err('parseSlug fabric-api', `(${a})`);
        b === 'sodium' ? ok('parseSlug sodium w/ query') : err('parseSlug sodium w/ query', `(${b})`);
        c === 'sodium' ? ok('parseSlug direct slug') : err('parseSlug direct slug', `(${c})`);
        d === 'dynamic-fps' ? ok('parseSlug with comment') : err('parseSlug with comment', `(${d})`);
    } catch (e) {
        err('parseSlug threw', e.message);
    }

    // buildDownloadPageURL
    try {
        const url = buildDownloadPageURL('sodium', '1.21.8', 'fabric');
        url.includes('version=1.21.8') && url.includes('loader=fabric') && url.endsWith('#download')
            ? ok('buildDownloadPageURL format')
            : err('buildDownloadPageURL format', `(${url})`);
    } catch (e) {
        err('buildDownloadPageURL threw', e.message);
    }

    // pickPrimaryFile
    try {
        const files = [{ filename: 'a.jar' }, { filename: 'b.jar', primary: true }, { filename: 'c.jar' }];
        const f = pickPrimaryFile(files);
        f && f.filename === 'b.jar'
            ? ok('pickPrimaryFile picks primary')
            : err('pickPrimaryFile picks primary', f ? `(${f.filename})` : '(null)');
    } catch (e) {
        err('pickPrimaryFile threw', e.message);
    }

    // choosePreferredVersion
    try {
        const versions = [{ version_type: 'beta' }, { version_type: 'release' }, { version_type: 'alpha' }];
        const v = choosePreferredVersion(versions, 'release');
        v && v.version_type === 'release'
            ? ok('choosePreferredVersion selects by channel')
            : err('choosePreferredVersion selects by channel', v ? `(${v.version_type})` : '(null)');
    } catch (e) {
        err('choosePreferredVersion threw', e.message);
    }

    const el = document.getElementById('testResults');
    el.classList.remove('muted');
    el.innerHTML = out.map((s) => `<div>${s}</div>`).join('');
}

// Bind handlers une fois le DOM prêt
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buildLinks').addEventListener('click', handleBuildLinks);
    document.getElementById('zipAll').addEventListener('click', handleZipAll);
    document.getElementById('runTests').addEventListener('click', runTests);
    document.getElementById('clear').addEventListener('click', () => {
        document.getElementById('mods').value = '';
        clearResults();
    });
});
