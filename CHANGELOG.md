# Changelog

All notable changes to this project, organized by day.

## 2026-09-25
- Moved preview images on the top of the `README`.
- Refactored server actions (`dashboard/actions.ts`) in multiple files (`lib/actions/*`)
- Updated file explorer general design and fixed mutliple bugs.
- Added inline rename action.
- Added color on icons.
- Added custom confirm modal.
- Removed open file functions.

## 2026-09-24
- Moved `publish_new_version.sh` in the `/scripts` folder.
- Fixed close correctly the file explorer when opening a file.
- Added documentation in README on automatic deployment.

## 2026-09-21
- Added automatic deployment script with it service and timer.
- Added GitHub link in the footer of the editor.
- Moved `Dockerfile.dev` in the `/app` folder.


## 2026-09-18
- Added `use the application` link in README.
- Added `install_fonts.sh` in the `Dockerfile` and add documentation in techdocs.
- Added database variabes, server actions, role & permissions and changelog to the documentation (techdoc).
- Added the owner’s name at the top of the thumbnails for the guest projects.
- Added the changelog
- Removed the "edit page" link on the landing page
- Added documentation for the update script
- Added a `pull` command to the deployment script
- Added a viewer role for project sharing, with related security restrictions (view-only access enforced)
- Added deployment documentation
- Various fixes: English translation, formatting, ESLint

## 2026-09-17
- Added PR template
- Added contributing guidelines
- Added issue templates
- Added a search bar to the docs
- Fixed URL/redirection issues on `/docs` (port handling)
- Added `DB_PASSWORD` to `.env.example`
- Added preview images
- Simplified the README
- Added documentation and preview support for templates (limited to showing max 4 templates)
- Added a new template in its own file
- Fixed production deployment issues
- Switched from `curl` to `wget` in scripts
- Hid author/last-update info where not needed
- Fixed `.gitignore`
- Added Nginx and docs handling to the deployment script
- Made the deployment script executable and added a new version script
- Updated README for documentation
- Added link to docs in the footer
- Removed lockfile, fixed `.gitignore`, ESLint and formatting fixes
- Added troubleshooting section and sub-categories to docs
- Added CI
- Documented: realtime collaboration, API endpoints, authentication, database schema, project structure, architecture, configuration, and installation

## 2026-09-14
- Documentation: reverse proxy, storage, multi-editing, export, file management, archiving, collaboration, project creation, login, intro section, landing page, default docs — translated to English
- Upgraded the navbar
- Generated project preview thumbnails (new architecture, generation logic, API route, hover-to-preview, throttle tuning)
- Updated README (CI)
- Added TypeScript typecheck to pre-commit hook
- Added ESLint to CI/CD, with related fixes across dashboard, auth, websocket server, socket server, quota service, editor/zoom hooks, log pane, Monaco editor, project actions, and compile route
- Added email verification to the user model
- Various build fixes

## 2026-09-11
- Implemented SSO with Switch edu-ID: automatic login, custom welcome text, env vars, signup removed, Keycloak logout handling
- Added automatic ESLint fixing and a new CI workflow
- Implemented project archiving: archive button, inactive section, related UI fixes (actions overflow) and formatting

## 2026-09-10
- Added custom 404 page
- Removed the production `docker-compose` file and other unused files
- Implemented CI/CD regression testing: pre-commit hook, permissions, Prettier formatting, build workflow
- Removed Cypress
- Implemented a tagging system for project organization: tags in DB and helper functions, tag creation, listing/editing, filtering, tags shown in the editor
- Synced editor and rendering: added page gap and marker-based synchronization

## 2026-09-07
- Reworked the preview container ref initialization

## 2026-09-04
- Enabled font downloading (closes #79)
- Removed legacy code and reworked fetching of the latest template version
- Removed sidebar
- Fixed tab handling (opening one tab now closes the other)
- Fixed SVG export and undefined variable issues
- Restored the "shared" badge
- Fixed quota calculation (now only counts owner's own projects, shared project counts, email counting via a Set)
- Redesigned and relocated the storage usage bar
- Various fixes: English translation, removed hidden overflow on dashboard, line wrapping, font size now controlled via settings panel, removed screenshots, dropped `curl` from healthcheck, removed app version computation

## 2026-09-03
- Removed temporary files
- Fixed build errors and Docker Compose issues
- Added and adopted a production Docker Compose setup in CI

## 2026-06-03
- Added font size control to the editor

## 2026-05-21
- Added handling for when a project owner wants to leave a shared project

## 2026-05-07
- Started implementing spellcheck in the editor

## 2026-05-02
- Updated README

## 2026-04-29
- Implemented quotas

## 2026-04-15
- Automatic fetching of the latest template version

## 2026-04-02
- Limited PDF/SVG export to a single run, and disabled export on error

## 2026-04-01
- Increased timeouts (general and template generation)
- Strengthened account creation security, with related Cypress test updates

## 2026-03-06
- Increased template fetch cache to 24 hours
- Updated favicon and metadata
- Fixed env setup instructions

## 2026-03-05
- File explorer now closes automatically when opening a file
- Added a diagram to the README
- Log pane now opens automatically on compilation error
- Fixed compilation error on empty Typst files
- Added "new version" section and update script to docs
- Fixed footer position (closes #67)
- Removed stray console.log
- Clicking the trash icon now clears the UI by closing the pane (closes #66)
- Branch name now shown when not on `main`
- Fixed README, injected build-time variables, added dependencies
- Display app version from git (closes #63)

## 2026-03-04
- Set `userns_mode: host` in Docker Compose (closes #61)
- Compilation now uses a temp directory
- Source code passed directly to the compiler
- Fixed UTF-8 encoding and share-project bug
- Errors now returned correctly (closes #60)
- Removed bad advice about storing credentials (closes #56)
- Added session handling to tests
- Production adaptation (closes #58, #59)
- Optimized Dockerfile and removed unused dependencies (closes #57)

## 2026-02-27
- Added script to push image to Docker Hub
- Compiler log now displayed (closes #37)

## 2026-02-26
- Added code comments
- Added ability to select the main file (closes #35)
- Switched to relative URLs
- Added real-time cursor tracking (closes #33)

## 2026-02-25
- Ignored hydration errors, added Cypress test timeout
- Fixed CI/CD auth secret
- Merged API and WebSocket server into the main app

## 2026-02-13
- Fixed WebSocket data loss issues, cleanup, and reduced edit conflicts/delay
- Added ZIP export, image previews, breadcrumbs, and drag-and-drop for files
- Code indentation cleanup, removed unused function (closes #28)
- Updated toast icon (closes #29)

## 2026-02-12
- Editor language now updates on file change (closes #27)
- Updated documentation (closes #26)
- Socket event emitted on file tree update (closes #25)
- Show email info on hover (closes #21)
- Show number of active members
- Added debounce to WebSocket-triggered compilation (closes #22)
- Added F2 rename shortcut (closes #20)
- Added context menu (closes #23)
- Added ability to create files (closes #19)
- Blocked opening of binary files
- Fixed subfolder file creation

## 2026-02-11
- Allowed users to edit all files

## 2026-02-06
- Switched from middleware to a proxy (closes #17)
- Updated README
- Added multi-editing support: WebSocket server and communication layer, security for multi-editing

## 2026-01-30
- Renamed the repository and updated README accordingly (closes #12, #13)

## 2026-01-29
- Fixed GitHub Actions workflow
- Removed Cypress return statement, updated env vars, added GitHub secrets and token handling

## 2026-01-28
- Added GitHub token to CI

## 2026-01-22
- Fixed HTML entity encoding in README
- Renamed items for clarity
- Show loader while rendering
- Added Cypress tests (closes #11)

## 2026-01-21
- Migrated JS to JSX, transformed file manager and zoom logic (closes #9)
- Added real Typst language support
- Updated dashboard UI
- Fixed loader when creating from a template
- Added shared project info
- Switched IDs to UUID (closes #10)
- Fixed Postgres port, created Editor components

## 2026-01-16
- UI updates, added logout
- Migrated server to Bun
- Added "new folder" prompt (closes #2)
- Updated documentation (closes #4)
- Added template selection on project creation (closes #3)
- Made the editor collapsible/shortenable (closes #7)
- Added icons
- Added ability to remove sharing (closes #6)
- Show shared projects (closes #8)
- Updated project sharing/users UI

## 2026-01-15
- Added Docker Compose setup (dependencies, `DATABASE_URL`, build fixes)
- Added Monaco Editor
- Added footer and loader while compiling
- Migrated to Bun
- Translated French → English
- Added project sharing
- Added image saving

## 2026-01-14
- Added content saving and dashboard
- Added auth middleware and signup
- Added login
- Added DB init script, migration, removed Prisma env leftovers
- Fixed CSS issues, updated `getIcon` function
- Fixed README language, added page resizing, updated file icons

## 2026-01-09
- Fixed inserting documents into subfolders (closes #1)
- Added known issues section
- Added Docker Compose

## 2026-01-07
- Added local storage for images
- Fixed root folder handling

## 2025-12-18
- Fixed language issues, updated design, adapted app to Docker

## 2025-12-10
- Project initialized, README added
- Initial commit