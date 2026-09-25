'use server';

import { FileNode, ProjectFileTree } from '@/types/filetree';

/**
 * Builds the fetch options for the GitHub API, with or without the auth token.
 */
function getFetchOptions(useAuth = true) {
  const headers: Record<string, string> = {
    'User-Agent': 'TISC-Editor-App',
  };

  if (useAuth && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return {
    headers,
    next: { revalidate: 86400 },
  };
}

/**
 * Makes a request to GitHub using the token when available, and retries without
 * the token if the authenticated request fails (401, or 404 on raw.githubusercontent.com).
 */
async function fetchGitHub(url: string) {
  const authResponse = await fetch(url, getFetchOptions(true));
  if (
    process.env.GITHUB_TOKEN &&
    (authResponse.status === 401 ||
      (authResponse.status === 404 && url.includes('raw.githubusercontent.com')))
  ) {
    console.warn(`GitHub token invalid or blocked, retrying without auth for ${url}`);
    return await fetch(url, getFetchOptions(false));
  }
  return authResponse;
}

/**
 * Downloads a GitHub file's content and returns it base64-encoded as a data URI.
 */
async function getFileContentAsBase64(url: string) {
  const response = await fetchGitHub(url);

  if (!response.ok) {
    throw new Error(
      `Unable to download file from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  const base64 = buffer.toString('base64');

  return `data:application/octet-stream;base64,${base64}`;
}

/**
 * Recursively walks a GitHub directory to rebuild the file tree, excluding hidden
 * files, .md files, LICENSE, and the template file.
 */
const buildTreeFromGitHub = async (
  url: string,
  currentPath: string = '',
  templateFile = '',
): Promise<{ [key: string]: FileNode }> => {
  const response = await fetchGitHub(url);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded.');
    }
    throw new Error(`GitHub API error ${response.status} ${response.statusText}`);
  }

  const items = await response.json();

  if (!Array.isArray(items)) {
    return {};
  }

  const children: { [key: string]: FileNode } = {};

  for (const item of items) {
    const newPath = currentPath === '' ? `${item.name}` : `${currentPath}/${item.name}`;

    if (
      item.name.startsWith('.') ||
      item.name.endsWith('.md') ||
      item.name === 'LICENSE' ||
      newPath === templateFile
    ) {
      continue;
    }

    if (item.type === 'dir') {
      children[item.name] = {
        type: 'folder',
        name: item.name,
        children: await buildTreeFromGitHub(item.url, newPath, templateFile),
      };
    } else {
      children[item.name] = {
        type: 'file',
        name: item.name,
        fullPath: newPath,
        data: await getFileContentAsBase64(item.download_url),
      };
    }
  }

  return children;
};

/**
 * Returns the latest (semver) version of a Typst package available in the
 * typst/packages repository.
 */
export async function getLatestVersion(packageBaseName: string): Promise<string> {
  const url = `https://api.github.com/repos/typst/packages/contents/packages/preview/${encodeURIComponent(packageBaseName)}`;

  const response = await fetchGitHub(url);

  if (!response.ok) {
    throw new Error(
      `Unable to list versions for ${packageBaseName}: ${response.status} ${response.statusText}`,
    );
  }

  const items = await response.json();

  if (!Array.isArray(items)) {
    throw new Error(`No versions found for ${packageBaseName}`);
  }

  const versions = items
    .filter((item) => item.type === 'dir')
    .map((item) => item.name as string)
    .filter((name: string) => /^\d+\.\d+\.\d+$/.test(name));

  if (versions.length === 0) {
    throw new Error(`No valid semver versions found for ${packageBaseName}`);
  }

  versions.sort((a: string, b: string) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (pa[i] !== pb[i]) return pb[i] - pa[i];
    }
    return 0;
  });

  return versions[0];
}

/**
 * Imports a Typst package from GitHub and builds the full project file tree,
 * adding the template file as main.typ.
 */
export const importPackageAsTree = async (
  packageName: string,
  templateFile: string,
): Promise<{ fileTree: ProjectFileTree }> => {
  if (!packageName || !templateFile) {
    throw new Error('Invalid package name or template file.');
  }

  const safePackageName = packageName.split('/').map(encodeURIComponent).join('/');
  const safeTemplateFile = encodeURIComponent(templateFile);

  const url = `https://api.github.com/repos/typst/packages/contents/packages/preview/${safePackageName}`;

  try {
    const treeData = await buildTreeFromGitHub(url, '', templateFile);

    const rawUrl = `https://raw.githubusercontent.com/typst/packages/main/packages/preview/${safePackageName}/${safeTemplateFile}`;
    const response = await fetchGitHub(rawUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to download template "${templateFile}" from GitHub: ${response.status} ${response.statusText} (${rawUrl})`,
      );
    }

    const content = await response.text();

    const mainFileName = 'main.typ';

    treeData[mainFileName] = {
      type: 'file',
      name: mainFileName,
      fullPath: mainFileName,
      isMain: true,
      data: content.replace(/\0/g, ''),
    };

    return {
      fileTree: {
        type: 'folder',
        name: 'root',
        children: treeData,
      },
    };
  } catch (error) {
    console.error('Template import error:', error);

    throw new Error(
      `Template import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
