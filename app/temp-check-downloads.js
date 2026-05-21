async function run() {
  const rootUrl = 'https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src';
  const headers = { 'User-Agent': 'TISC-Editor-App' };
  const res = await fetch(rootUrl, { headers });
  const items = await res.json();
  console.log('root status', res.status, 'count', items.length);
  for (const item of items) {
    console.log(item.name, item.type, item.download_url || item.url);
  }
  const file = items.find(i => i.type === 'file');
  if (file) {
    const r = await fetch(file.download_url, { headers });
    console.log('first file fetch', file.name, r.status, await r.text().then(t => t.slice(0,80)));
  }
}
run().catch(e=>console.error(e));
