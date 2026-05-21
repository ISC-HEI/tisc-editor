(async () => {
  const url = 'https://raw.githubusercontent.com/typst/packages/main/packages/preview/isc-hei-bthesis/0.6.0/src/acronyms.typ';
  const res = await fetch(url, { headers: { 'User-Agent': 'TISC-Editor-App', Authorization: 'Bearer badtoken' } });
  console.log(res.status, res.statusText);
  const text = await res.text();
  console.log(text.slice(0,80));
})();
