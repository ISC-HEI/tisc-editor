function getFetchOptions(useAuth=true) {
  const headers = { 'User-Agent': 'TISC-Editor-App' };
  if (useAuth && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return { headers };
}

async function fetchGitHub(url) {
  let res = await fetch(url, getFetchOptions(true));
  if (res.status === 401 && process.env.GITHUB_TOKEN) {
    console.warn('retrying without auth for', url);
    res = await fetch(url, getFetchOptions(false));
  }
  return res;
}

async function getFileContentAsBase64(url) {
  const response = await fetchGitHub(url);
  console.log('download', url, response.status);
  if (!response.ok) {
    throw new Error(`Unable to download file from GitHub: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:application/octet-stream;base64,${buffer.toString('base64')}`;
}

async function buildTreeFromGitHub(url, currentPath = '', templateFile = '') {
  const response = await fetchGitHub(url);
  console.log('fetch tree', url, response.status);
  if (!response.ok) throw new Error(`GitHub API error ${response.status} ${response.statusText}`);
  const items = await response.json();
  if (!Array.isArray(items)) return {};
  const children = {};
  for (const item of items) {
    const newPath = currentPath === '' ? `${item.name}` : `${currentPath}/${item.name}`;
    if (item.name.startsWith('.') || item.name.endsWith('.md') || item.name === 'LICENSE' || newPath === templateFile) continue;
    if (item.type === 'dir') {
      children[item.name] = {
        type: 'folder',
        name: item.name,
        children: await buildTreeFromGitHub(item.url, newPath, templateFile)
      };
    } else {
      const data = await getFileContentAsBase64(item.download_url);
      children[item.name] = { type: 'file', name: item.name, fullPath: newPath, data };
    }
  }
  return children;
}

(async () => {
  try {
    const pkg = 'isc-hei-bthesis/0.6.0/src';
    const tree = await buildTreeFromGitHub(`https://api.github.com/repos/typst/packages/contents/packages/preview/${pkg}`, '', 'bachelor_thesis.typ');
    console.log('done');
  } catch (e) {
    console.error('ERR', e);
  }
})();
