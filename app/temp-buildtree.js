async function buildTreeFromGitHub(url, currentPath = '', templateFile = '') {
  const res = await fetch(url, { headers: { 'User-Agent': 'TISC-Editor-App' } });
  console.log('buildTree url', url, 'status', res.status);
  if (res.status === 403) throw new Error('GitHub API Rate limit exceeded.');
  const items = await res.json();
  if (!Array.isArray(items)) return {};
  const children = {};
  for (const item of items) {
    const newPath = currentPath === '' ? `${item.name}` : `${currentPath}/${item.name}`;
    if (item.name.startsWith('.') || item.name.endsWith('.md') || item.name === 'LICENSE' || newPath === templateFile) {
      continue;
    }
    if (item.type === 'dir') {
      children[item.name] = {
        type: 'folder',
        name: item.name,
        children: await buildTreeFromGitHub(item.url, newPath, templateFile)
      };
    } else {
      children[item.name] = {
        type: 'file',
        name: item.name,
        fullPath: newPath,
        data: 'ok'
      };
    }
  }
  return children;
}
(async () => {
  try {
    const tree = await buildTreeFromGitHub('https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src', '', 'bachelor_thesis.typ');
    console.log('tree keys', Object.keys(tree));
  } catch (e) {
    console.error(e);
  }
})();
