<div align="center">
  <img alt="TISC" src="../img/banner.jpg">
  <h1>TISC Compilation API</h1>
  <p>A Node.js microservice for on-the-fly Typst rendering.</p>
</div>

## Overview

The **TISC API** is a dedicated service that compile and convert typst document. It is designed to be **stateless** and **secure**, receiving all project assets (code, images, modules) via Base64 to produce professional PDF or SVG outputs instantly.



### Key Capabilities
- **On-the-fly Rendering:** Instant conversion of Typst code to SVG or PDF.
- **Stateless Architecture:** No database or persistent storage required on the server; everything is in the payload.
- **Secure Sandboxing:** Each request is processed in a unique temporary directory, ensuring total isolation between users.
- **Recursive File Support:** Handles not only images but also nested `.typ` files and assets.


## Getting Started

### 1. Prerequisites
- **Node.js**

### 2. Installation
```bash
# Navigate to the server directory
cd server

# Install dependencies
bun i

# Start development server
bun dev
```

## API Reference
The API exposes two main endpoints for document generation.

| Endpoint       | Method | Body | Description |
|----------------|--------|------|-------------|
| /render        | POST   |   `payload`   |Renders the document to SVG (best for live previews). |
| /export/pdf    | POST   | `payload` | Exports a Typst document to PDF |


### Payload Structure
The API expects a JSON body with the following format:
```json
{
  "source": "= Hello TISC\n#image(\"/assets/logo.png\")",
  "imgPaths": {
    "/assets/logo.png": "data:image/png;base64,iVBORw0KGgoAAA..."
  }
}
```
`source` : The Typst document content as a string.  
`imgPaths` : Optional object mapping image paths to Base64-encoded images.

## Asset Processing Workflow

To ensure high performance and zero-clutter, the API follows a strict lifecycle for every request:

1. **Virtual Mapping**: The API parses the imgPaths and recreates the directory structure in a temporary "sandbox".

2. **Decoding**: Base64 strings are converted back into binary files on the fly.

3. **Compilation**: The Typst binary is executed within the sandbox.

4. **Streaming**: The resulting SVG/PDF is read and sent back to the client as a stream.

5. **Auto-Cleanup**: The entire temporary workspace is deleted immediately after the response is sent, regardless of whether the compilation succeeded or failed.
  
## License
This service is licensed under the Apache License 2.0. See the [LICENSE](../LICENSE) file for details.

## Disclaimer
This project is an independent work and is not affiliated with, endorsed by, or supported by the official Typst organization.
