# Font Management

Typst compiles documents using **locally installed fonts**. TISC Editor relies on a custom font bundle (`modern-isc-fonts-v2`) that must be present on the machine running the Typst binary — otherwise document compilation may fail or fall back to incorrect fonts.

To handle this, the project ships a dedicated script: [`fonts/install_fonts.sh`](https://github.com/ISC-HEI/tisc-editor/blob/main/fonts/install_fonts.sh).

## What the script does

| Step | Action |
| :--- | :--- |
| **1. Check** | If `typst` is available, checks whether all required fonts are already installed (via `typst fonts`). If so, exits immediately — nothing to do. |
| **2. Download** | Downloads the font archive from `files.isc-vs.ch` into a temporary directory. |
| **3. Verify** | Inspects the archive contents before extracting anything: only `.ttf` / `.otf` files and folders are allowed, and any suspicious path (e.g. `../`) causes the script to abort. This prevents path traversal or unexpected file injection from a compromised archive. |
| **4. Extract & copy** | Extracts the archive and copies the font files into `~/.local/share/fonts`. |
| **5. Rebuild cache** | Runs `fc-cache -f` to refresh the system's font cache. |
| **6. Final check** | Re-verifies with `typst fonts` that all required fonts are now available. The script fails loudly if any are still missing. |

### Required fonts

- Source Sans Pro
- Source Sans 3
- Inria Sans
- Fira Code

:::info
The script is idempotent: running it multiple times is safe. If the required fonts are already installed, it exits immediately without downloading anything.
:::

## Local usage

To install the fonts manually on your machine (e.g. for local development or testing Typst compilation outside Docker):

```bash
./fonts/install_fonts.sh
```

No arguments are required. The script installs the fonts for the current user only (`~/.local/share/fonts`), so no root privileges are needed.

## Production usage

In production, font installation is **automated** as part of the deployment: `fonts/install_fonts.sh` is invoked automatically during `publish_new_version.sh`, ensuring the compilation environment always has the required fonts available before the app starts serving Typst compilation requests.

:::tip
You don't need to run `install_fonts.sh` manually before deploying to production — the deployment script takes care of it. Manual execution is only needed for local development environments running Typst outside the provided Docker setup.
:::
