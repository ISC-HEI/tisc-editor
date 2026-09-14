import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    { type: 'doc', id: 'tutorial/intro', label: 'Getting Started' },
    { type: 'doc', id: 'tutorial/login', label: 'Access the editor' },
    { type: 'category', label: 'Projects Management', items: [
      { type: 'doc', id: 'tutorial/projects/create', label: 'Create Project' },
      { type: 'doc', id: 'tutorial/projects/sharing', label: 'Collaborate on Project' },
      { type: 'doc', id: 'tutorial/projects/archive', label: 'Archive Project' },
    ]},
    { type: 'category', label: 'Using the Editor', items: [
      { type: 'doc', id: 'tutorial/editor/compilation', label: 'Code Compilation' },
      { type: 'doc', id: 'tutorial/editor/files', label: 'Files Management' },
      { type: 'doc', id: 'tutorial/editor/export', label: 'Export Files' },
    ]}

  ],
  techdocsSidebar: [
    'techdocs/intro',
  ],
};

export default sidebars;
