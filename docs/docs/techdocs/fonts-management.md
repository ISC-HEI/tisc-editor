# Font Management

Typst compiles documents using **locally installed fonts**. TISC Editor relies on a custom font bundle (`modern-isc-fonts-v2`) that must be present in the compilation environment — otherwise document compilation may fail or fall back to incorrect fonts.

Font installation is handled entirely **at Docker build time** by [`app/fonts/install_fonts.sh`](https://github.com/ISC-HEI/tisc-editor/blob/main/app/fonts/install_fonts.sh), which is invoked from the app's `Dockerfile`. Fonts are never installed on the host machine or at container runtime — they are baked directly into the image.

:::info
This means fonts do not need to be installed manually, in development or in production. Simply building the Docker image (`docker build ./app`) is enough — the resulting image already contains all required fonts.
:::

## What the script does (at build time)

| Step | Action |
| :--- | :--- |
| **1. Check** | If `typst` is already available in the build stage, checks whether all required fonts are already installed. If so, exits immediately. |
| **2. Download** | Downloads the font archive from `files.isc-vs.ch` into a temporary directory. |
| **3. Verify** | Inspects the archive contents before extracting anything: only `.ttf` / `.otf` files and folders are allowed. Any suspicious path (e.g. `../`) aborts the build. |
| **4. Extract & copy** | Extracts the archive and copies the font files into `/usr/local/share/fonts`. |
| **5. Rebuild cache** | Runs `fc-cache -f` to refresh the system's font cache inside the image. |
| **6. Final check** | Re-verifies with `typst fonts` that all required fonts are now available. Fails the build loudly if any are still missing. |

### Required fonts

- Source Sans Pro
- Source Sans 3
- Inria Sans
- Fira Code

### Install path
```
/usr/local/share/fonts
```

This fixed, system-wide path is used both by the install script (`DEST_DIR`) and by the Typst compilation binding:

```js
fontArgs: [{ fontPaths: ['/usr/local/share/fonts'] }],
```

:::warning
These two paths must always match. If you ever change one, update the other — a mismatch will silently result in an empty fonts directory from Typst's point of view, even if the script ran "successfully".
:::

## Where it's wired in

```dockerfile
COPY fonts/install_fonts.sh /tmp/install_fonts.sh
RUN chmod +x /tmp/install_fonts.sh && \
    /tmp/install_fonts.sh && \
    rm -f /tmp/install_fonts.sh
```

This `RUN` step must execute as `root` (before any `USER` switch in the Dockerfile), since it writes to a system-wide directory.
