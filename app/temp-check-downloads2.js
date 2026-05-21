async function run() {
  const headers = { 'User-Agent': 'TISC-Editor-App' };
  const fetchJson = async (url) => { const res = await fetch(url, { headers }); return { status: res.status, body: await res.json() }; };
  const urls = [
    'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/code?ref=main',
    'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/figs?ref=main',
    'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/fonts?ref=main',
    'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/pages?ref=main',
    'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/themes?ref=main'
  ];
  for (const url of urls) {
    const { status, body } = await fetchJson(url);
    console.log('dir status', url, status, Array.isArray(body) ? body.length : typeof body);
    if (Array.isArray(body)) {
      for (const item of body) {
        if (item.type === 'file') {
          const r = await fetch(item.download_url, { headers });
          console.log('  file', item.name, item.download_url, r.status);
        }
      }
    }
  }
}
run().catch(e=>console.error(e));
