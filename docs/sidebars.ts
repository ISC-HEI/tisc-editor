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
      { type: 'doc', id: 'tutorial/editor/multi-editing', label: 'Multi-Editing' },
    ]},
    { type: 'doc', id: 'tutorial/storage', label: 'Storage Management' },
  ],
  techdocsSidebar: [
    { type: 'doc', id: 'techdocs/intro', label: 'Getting Started' },
    { type: 'doc', id: 'techdocs/installation', label: 'Start the project' },
    { type: 'doc', id: 'techdocs/configuration', label: 'Configure your setup' },
    { type: 'category', label: 'Architecture & Data', items: [
      { type: 'doc', id: 'techdocs/architecture/architecture', label: 'Architecture Overview' },
      { type: 'doc', id: 'techdocs/architecture/structure', label: 'Project Structure' },
      { type: 'doc', id: 'techdocs/architecture/database', label: 'Database Schema' },
    ]},
    { type: 'category', label: 'Core Systems', items: [
      { type: 'doc', id: 'techdocs/core-systems/authentication', label: 'Authentication & SSO' },
      { type: 'doc', id: 'techdocs/core-systems/api-endpoints', label: 'API Endpoints' },
      { type: 'doc', id: 'techdocs/core-systems/server-actions', label: 'Server Actions' },
      { type: 'doc', id: 'techdocs/core-systems/collaboration', label: 'Real-time Collaboration' },
      { type: 'doc', id: 'techdocs/core-systems/templates', label: 'Template Management' },
      { type: 'doc', id: 'techdocs/core-systems/role-permissions', label: 'Role & Permissions' },
    ]},
    { type: 'doc', id: 'techdocs/devops/ci', label: 'Continuous Integration' },
    { type: 'doc', id: 'techdocs/deployment', label: 'Deployment' },
    { type: 'doc', id: 'techdocs/troubleshooting', label: 'Troubleshooting' },
  ],
};

export default sidebars;
