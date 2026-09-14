export interface FileTreeNode {
  type?: 'file' | 'folder';
  name?: string;
  data?: string;
  content?: string;
  children?: Record<string, FileTreeNode>;
}

export interface FileNode {
  type: 'file' | 'folder';
  name: string;
  fullPath?: string;
  data?: string;
  content?: string;
  isMain?: boolean;
  children?: { [key: string]: FileNode };
}

export interface ProjectFileTree {
  type: 'folder';
  name: string;
  children: { [key: string]: FileNode };
}
