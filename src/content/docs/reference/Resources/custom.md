---
title: Custom
description: Custom resource definition reference for container-based modules
sidebar:
    order: 3
---

# Custom Resources

Custom resources define Docker container-based modules that can be executed within a Module. They provide a flexible way to run custom installation, configuration, and management logic using containerized HTTP services that integrate with the operator.

## Structure

All Custom resources share this common structure:

```yaml
kind: Custom
metadata:
  name: <resource-name>
  version: <semver>
  supportedOperatorVersion: <version-constraint>
  author: <optional-author>
  description: <optional-description>
  category: <optional-category>
  image: <optional-image-url>
  resource_usage:
    cpu: <cpu-requirement>
    memory: <memory-requirement>
config:
  - type: <config-type>
    name: <config-name>
    alias: <config-alias>
    spec: <type-specific-spec>
spec:
  image: <docker-image-reference>
  imagePullSecrets: # Optional
    - <secret-name>
  permissions: # Optional
    - workspace|controller
```

## Metadata Fields

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Unique identifier for the resource | Yes |
| `version` | string | Semantic version of the resource definition | Yes |
| `supportedOperatorVersion` | string | Operator version constraint (semver format, e.g., ">= 0.0.0, < 1.0.0") | Yes |
| `author` | string | Resource author or maintainer | No |
| `description` | string | Human-readable description of the resource | No |
| `category` | string | Resource category for organization | No |
| `image` | string | URL to an icon or logo image | No |
| `resource_usage.cpu` | string | Expected CPU usage (e.g., "500m", "2") | No |
| `resource_usage.memory` | string | Expected memory usage (e.g., "512Mi", "2Gi") | No |

## Config Fields

The `config` array defines user-configurable parameters. See [Configuration Schema](/reference/resources/overview/#configuration-schema) for details on configuration types.

## Spec Fields

The `spec` section defines how the custom module container should be deployed and what permissions it has.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `spec.image` | string | Docker image reference (e.g., `my-registry/my-module:v1.0.0`) | Yes |
| `spec.imagePullSecrets` | array of strings | List of Kubernetes secret names for pulling private images | No |
| `spec.permissions` | array of strings | Cluster access permissions. `workspace` = workspace kubeconfig, `controller` = operator service account | No |

### Image

The `image` field specifies the Docker container image that contains your custom module implementation.

**Example:**
```yaml
spec:
  image: my-registry/my-module:v1.0.0
```

**Note**: The image must be accessible from your Kubernetes cluster. You can use:
- Public registries (Docker Hub, GHCR, etc.)
- Private registries (requires image pull secrets)
- Internal registries within your cluster

### Image Pull Secrets

The `imagePullSecrets` field specifies Kubernetes secrets containing credentials for pulling images from private registries.

**Example:**
```yaml
spec:
  image: my-private-registry.com/my-module:v1.0.0
  imagePullSecrets:
    - my-registry-secret
    - another-registry-secret
```

**Creating an image pull secret:**
```bash
kubectl create secret docker-registry my-registry-secret \
  --docker-server=my-private-registry.com \
  --docker-username=myusername \
  --docker-password=mypassword \
  --docker-email=myemail@example.com \
  -n forkspacer-system
```

**Note:** The secret must be created in the `forkspacer-system` namespace where custom module pods run.

### Permissions

The `permissions` field specifies what level of cluster access the custom module container receives. This determines which kubeconfig or service account credentials are provided to the module.

**Available Permissions:**

- **`workspace`**: Provides the module with the kubeconfig file of the target workspace. The module can access and manage resources in the workspace's cluster (which may be a remote cluster or in-cluster). This is the recommended permission for most custom modules that only need to manage resources within their assigned workspace.

- **`controller`**: Provides the module with access to the main cluster (where the Forkspacer operator is installed) via a service account. The module runs with elevated permissions similar to the operator itself. Use this only for modules that need to manage operator-level resources or interact with multiple workspaces.

**Example with workspace permissions:**
```yaml
spec:
  image: my-registry/my-module:v1.0.0
  permissions:
    - workspace
```

The module will receive the workspace's kubeconfig and can manage resources in that workspace's cluster.

**Example with controller permissions:**
```yaml
spec:
  image: my-registry/admin-module:v1.0.0
  permissions:
    - controller
```

The module will receive a service account with access to the main cluster where the operator runs.

**Security Note**: Only grant `controller` permissions when your module needs to interact with the operator's cluster or manage multiple workspaces. Most custom modules should use `workspace` permissions for better security isolation.

## HTTP API Interface

Custom modules are containerized HTTP services that implement a REST API for lifecycle management. The operator communicates with these services via HTTP endpoints.

### Required Endpoints

All custom modules must implement the following HTTP endpoints:

#### Health Check
```
GET /health
Response: 200 OK
{
  "timestamp": "2025-10-14T10:30:00Z",
  "uptime": 123.45,
  "message": "Service is running",
  "healthy": true
}
```

#### Install
```
POST /install
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 201 Created (on success) or 400 Bad Request (on failure)
```

Called when a Module is created or needs to be installed. This endpoint should deploy and configure all required resources.

#### Uninstall
```
POST /uninstall
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 204 No Content (on success) or 400 Bad Request (on failure)
```

Called when a Module is deleted. This endpoint should remove all resources and clean up.

#### Sleep
```
POST /sleep
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 200 OK (on success) or 400 Bad Request (on failure)
```

Called when a Module is hibernated. This endpoint should scale down or pause resources to save costs.

#### Resume
```
POST /resume
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 200 OK (on success) or 400 Bad Request (on failure)
```

Called when a Module is resumed from hibernation. This endpoint should scale up or restore resources.

### Configuration Access

Configuration values are passed to each endpoint as JSON in the request body. The metadata parameter persists across lifecycle operations and can be used to store state information.

### Error Handling

- Return appropriate HTTP status codes (200, 201, 204 for success; 400, 500 for errors)
- Include descriptive error messages in the response body
- Use structured logging for debugging and status messages

## Examples

### Complete Custom Module Example

**Resource Definition:**

```yaml
kind: Custom
metadata:
  name: custom-app-installer
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "Custom application installer"
  author: "DevOps Team"
  category: "Application"

config:
  - type: option
    name: environment
    alias: env
    spec:
      required: true
      default: "development"
      values:
        - development
        - staging
        - production
      editable: true

  - type: boolean
    name: enableDebug
    alias: debug
    spec:
      required: false
      default: false
      editable: true

  - type: string
    name: namespace
    alias: namespace
    spec:
      required: true
      default: "default"
      editable: true

spec:
  image: my-registry/custom-app-installer:v1.0.0
  permissions:
    - workspace
```

**HTTP Server Implementation (Go example):**

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

var startTime = time.Now()

type Handler struct {
	logger  *zap.Logger
	manager *Manager
}

func (h *Handler) Install(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaData(r)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if err = h.manager.Install(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.WriteHeader(201)
	json.NewEncoder(w).Encode(metaData)
}

func (h *Handler) Uninstall(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaData(r)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if err = h.manager.Uninstall(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.WriteHeader(204)
}

func (h *Handler) Sleep(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaData(r)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if err = h.manager.Sleep(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.WriteHeader(200)
	json.NewEncoder(w).Encode(metaData)
}

func (h *Handler) Resume(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaData(r)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if err = h.manager.Resume(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.WriteHeader(200)
	json.NewEncoder(w).Encode(metaData)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	response := map[string]any{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(startTime).Seconds(),
		"message":   "Service is running",
		"healthy":   true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	json.NewEncoder(w).Encode(response)
}

type Manager struct {
	logger *zap.Logger
}

func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
	env := metaData["env"].(string)
	debug := metaData["debug"].(bool)
	namespace := metaData["namespace"].(string)

	m.logger.Info("Installing custom application",
		zap.String("environment", env),
		zap.Bool("debug", debug),
		zap.String("namespace", namespace),
	)

	// Create namespace if it doesn't exist
	// Apply base manifests
	// Apply environment-specific configuration
	// Store deployment info in metaData for later use

	metaData["deploymentName"] = "my-app-deployment"
	metaData["installedResources"] = map[string]string{
		"deployment": "my-app-deployment",
		"service":    "my-app-service",
	}

	m.logger.Info("Installation completed successfully")
	return nil
}

func (m *Manager) Uninstall(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Uninstalling custom application")

	// Retrieve resources from metadata
	resources, ok := metaData["installedResources"].(map[string]any)
	if ok {
		// Delete resources in reverse order
		m.logger.Info("Deleting resources", zap.Any("resources", resources))
	}

	m.logger.Info("Uninstallation completed successfully")
	return nil
}

func (m *Manager) Sleep(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Hibernating custom application")

	// Scale down deployments to 0
	// Store current state in metaData

	return nil
}

func (m *Manager) Resume(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Resuming custom application")

	// Restore state from metaData
	// Scale up deployments

	return nil
}
```

### Simple Module Example

**Resource Definition:**

```yaml
kind: Custom
metadata:
  name: simple-module
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "Simple custom module"

spec:
  image: my-registry/simple-module:latest
  permissions:
    - workspace
```

**Minimal HTTP Server (Python example):**

```python
from flask import Flask, request, jsonify
import time

app = Flask(__name__)
start_time = time.time()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'uptime': time.time() - start_time,
        'message': 'Service is running',
        'healthy': True
    }), 200

@app.route('/install', methods=['POST'])
def install():
    metadata = request.get_json() or {}
    print(f"Installing with metadata: {metadata}")
    # Add your installation logic here
    return jsonify(metadata), 201

@app.route('/uninstall', methods=['POST'])
def uninstall():
    metadata = request.get_json() or {}
    print(f"Uninstalling with metadata: {metadata}")
    # Add your uninstallation logic here
    return '', 204

@app.route('/sleep', methods=['POST'])
def sleep():
    metadata = request.get_json() or {}
    print(f"Sleeping with metadata: {metadata}")
    # Add your sleep logic here
    return jsonify(metadata), 200

@app.route('/resume', methods=['POST'])
def resume():
    metadata = request.get_json() or {}
    print(f"Resuming with metadata: {metadata}")
    # Add your resume logic here
    return jsonify(metadata), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
```

### Private Registry Example

**Resource Definition with Image Pull Secrets:**

```yaml
kind: Custom
metadata:
  name: private-module
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "Custom module from private registry"
  author: "DevOps Team"

config:
  - type: string
    name: environment
    alias: env
    spec:
      required: true
      default: "production"
      editable: true

spec:
  image: my-private-registry.com/org/private-module:v1.0.0
  imagePullSecrets:
    - private-registry-secret
  permissions:
    - workspace
```

**Creating the image pull secret:**

```bash
# Create the secret in the forkspacer-system namespace
kubectl create secret docker-registry private-registry-secret \
  --docker-server=my-private-registry.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myemail@company.com \
  -n forkspacer-system
```

**Important:** Custom module pods run in the `forkspacer-system` namespace, so the image pull secret must be created there.

### Advanced Module with Controller Permissions

**Resource Definition:**

```yaml
kind: Custom
metadata:
  name: cluster-admin-module
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "Module requiring cluster-wide access"
  author: "Platform Team"
  category: "Administration"

config:
  - type: boolean
    name: enableClusterScanning
    alias: scan
    spec:
      required: false
      default: true
      editable: true

spec:
  image: my-registry/cluster-admin:v1.0.0
  permissions:
    - controller
```

**Note:** This module will have access to the operator's main cluster via a service account with elevated permissions. Use with caution and only when necessary.

## Creating a Custom Module from Scratch

This guide walks you through creating a custom module from start to finish.

### Step 1: Create Module Directory

Create a directory for your custom module:

```bash
mkdir -p my-custom-module
cd my-custom-module
```

### Step 2: Create HTTP Server

Create your HTTP server implementation. You can use any language that can run an HTTP server. Here's a Go example:

**`main.go`:**

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go listenForTermination(func() { cancel() })

	logger := initLogger()
	mux := setupRoutes(logger)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	logger.Info("Starting server", zap.String("port", port))
	runServer(ctx, httpServer, logger)
	logger.Info("Server stopped")
}

func setupRoutes(logger *zap.Logger) *http.ServeMux {
	mux := http.NewServeMux()
	manager := NewManager(logger)
	handler := NewHandler(logger, manager)

	mux.HandleFunc("GET /health", handler.Health)
	mux.HandleFunc("POST /install", handler.Install)
	mux.HandleFunc("POST /uninstall", handler.Uninstall)
	mux.HandleFunc("POST /sleep", handler.Sleep)
	mux.HandleFunc("POST /resume", handler.Resume)

	return mux
}

// ... (handler and manager implementations)
```

### Step 3: Create Dockerfile

**`Dockerfile`:**

```dockerfile
FROM golang:1.25 AS builder

WORKDIR /workspace

COPY go.mod go.mod
COPY go.sum go.sum
RUN go mod download

COPY ./ ./
RUN CGO_ENABLED=0 go build -ldflags "-s -w" -o plugin

FROM alpine:3.22.2

WORKDIR /output
COPY --from=builder /workspace/plugin .

ENV PORT=8080
EXPOSE ${PORT}

ENTRYPOINT ["./plugin"]
```

### Step 4: Build and Push Docker Image

Build your module image:

```bash
docker build -t my-registry/my-module:v1.0.0 .
docker push my-registry/my-module:v1.0.0
```

### Step 5: Create Resource Definition

Create a resource definition YAML file:

**`my-module-resource.yaml`:**

```yaml
kind: Custom
metadata:
  name: my-module
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "My custom module"
  author: "Your Name"
  category: "Application"

config:
  - type: string
    name: namespace
    alias: namespace
    spec:
      required: true
      default: "default"
      editable: true

  - type: string
    name: applicationName
    alias: appName
    spec:
      required: true
      editable: true

  - type: integer
    name: replicas
    alias: replicas
    spec:
      required: true
      default: 1
      min: 1
      max: 10
      editable: true

spec:
  image: my-registry/my-module:v1.0.0
  permissions:
    - workspace
```

### Step 6: Deploy the Module

Create a Module that uses your custom module:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
spec:
  workspace:
    name: dev-workspace
  source:
    httpURL: https://your-server.com/resources/my-module-resource.yaml
  config:
    namespace: my-namespace
    appName: my-application
    replicas: 3
```

## Module Distribution

Custom modules are distributed as Docker container images. You can host them on:

### Public Registries

**Docker Hub:**
```yaml
spec:
  image: myusername/my-module:v1.0.0
```

**GitHub Container Registry:**
```yaml
spec:
  image: ghcr.io/myorg/my-module:v1.0.0
```

### Private Registries

For private registries, ensure your Kubernetes cluster has the appropriate image pull secrets configured in the `forkspacer-system` namespace:

```yaml
spec:
  image: my-private-registry.com/my-module:v1.0.0
  imagePullSecrets:
    - my-registry-secret
```

**Create the secret:**
```bash
kubectl create secret docker-registry my-registry-secret \
  --docker-server=my-private-registry.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  -n forkspacer-system
```

### Versioning

Use semantic versioning for your images:

```yaml
spec:
  image: my-registry/my-module:v1.0.0  # Specific version
  # or
  image: my-registry/my-module:v1      # Major version
  # or
  image: my-registry/my-module:latest  # Latest (not recommended for production)
```

## Usage in Modules

To use a Custom resource in a Module:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
spec:
  workspace:
    name: dev-workspace
  source:
    httpURL: https://example.com/resources/custom-app.yaml
  config:
    env: production
    debug: false
    namespace: my-app
```

Or embed it directly:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
spec:
  workspace:
    name: dev-workspace
  source:
    raw:
      kind: Custom
      metadata:
        name: app-installer
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        image: my-registry/app-installer:v1.0.0
  config:
    namespace: my-namespace
```

## Best Practices

### Module Development

1. **API Implementation**: Always implement all five endpoints (health, install, uninstall, sleep, resume)
2. **Error Handling**: Return meaningful HTTP status codes and error messages
3. **Logging**: Use structured logging for debugging and monitoring
4. **Idempotency**: Ensure operations can be safely retried
5. **Context Handling**: Respect context cancellation signals
6. **Configuration Validation**: Validate configuration in the install endpoint
7. **Resource Cleanup**: Properly clean up resources in uninstall
8. **State Management**: Use metadata to persist state across lifecycle operations

### Building and Testing

1. **Containerization**: Use multi-stage Docker builds to minimize image size
2. **Security**: Don't include secrets in images; use Kubernetes secrets
3. **Testing**: Test modules in isolation before deployment
4. **Dependencies**: Pin dependency versions for reproducibility
5. **Health Checks**: Implement robust health check endpoints

### Deployment

1. **Image Registry**: Use reliable container registries with good availability
2. **Version Control**: Keep source code in version control
3. **Documentation**: Document module behavior and configuration
4. **Monitoring**: Include appropriate logging for observability
5. **Versioning**: Use semantic versioning for images
6. **Security Scanning**: Scan images for vulnerabilities before deployment

### Configuration Design

1. **Type Safety**: Use appropriate configuration types with validation
2. **Defaults**: Provide sensible default values
3. **Validation**: Use regex and constraints for input validation
4. **Editability**: Mark sensitive fields as non-editable when appropriate

## Related Resources

- [Plugin Development Guide](/development/plugin-development/) - Detailed guide for creating custom modules
