---
title: Custom Module Development
description: Guide for creating custom modules for the Forkspacer operator
sidebar:
  order: 2
---

# Custom Module Development

Forkspacer supports custom modules that allow you to extend the operator with custom resource management logic. Custom modules enable you to integrate third-party tools, implement custom deployment strategies, or handle specialized workloads beyond the built-in Helm support.

## What are Custom Modules?

Custom modules are containerized HTTP services that implement a REST API for lifecycle management. They run as separate Docker containers that communicate with the operator via HTTP endpoints.

### Custom Module Capabilities

A custom module must implement four core lifecycle endpoints:

- **Install** (`POST /install`): Deploy and configure resources
- **Uninstall** (`POST /uninstall`): Remove resources and clean up
- **Sleep** (`POST /sleep`): Hibernate or scale down resources
- **Resume** (`POST /resume`): Wake up or scale up resources
- **Health** (`GET /health`): Health check endpoint

## Custom Module Architecture

### HTTP API Interface

Custom modules expose an HTTP server that the operator calls to manage Module lifecycle. Each endpoint receives metadata as JSON in the request body and returns appropriate HTTP status codes.

#### Required Endpoints

**Health Check:**
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

**Install:**
```
POST /install
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 201 Created (on success) or 400 Bad Request (on failure)
```

**Uninstall:**
```
POST /uninstall
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 204 No Content (on success) or 400 Bad Request (on failure)
```

**Sleep:**
```
POST /sleep
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 200 OK (on success) or 400 Bad Request (on failure)
```

**Resume:**
```
POST /resume
Content-Type: application/json
Request Body: {"key": "value", ...}  // Module configuration
Response: 200 OK (on success) or 400 Bad Request (on failure)
```

## Creating a Custom Module

### Step 1: Create Module Directory

Create a directory for your custom module under `modules/custom/`:

```bash
mkdir -p modules/custom/my-module
cd modules/custom/my-module
```

### Step 2: Initialize Go Module

Create a `go.mod` file:

```bash
go mod init my-module
```

**Example `go.mod`:**
```go
module my-module

go 1.25.0

require go.uber.org/zap v1.27.0

require go.uber.org/multierr v1.10.0 // indirect
```

### Step 3: Write HTTP Server Code

Create `main.go` with an HTTP server that listens on a configurable port:

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
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
	port := getPort(logger)

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	logger.Info("Starting manager server", zap.String("port", port))
	runServer(ctx, httpServer, logger, port)
	logger.Info("Manager server stopped", zap.String("port", port))
}

func listenForTermination(do func()) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
	do()
}

func initLogger() *zap.Logger {
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	return logger
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

func getPort(logger *zap.Logger) string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	_, err := strconv.ParseUint(port, 10, 16)
	if err != nil {
		logger.Fatal(fmt.Sprintf("failed to parse port '%s' as uint16", port), zap.Error(err))
	}

	return port
}

func runServer(ctx context.Context, server *http.Server, logger *zap.Logger, port string) {
	listenerErrChan := make(chan error)
	go func() {
		listenerErrChan <- server.ListenAndServe()
	}()

	select {
	case err := <-listenerErrChan:
		if err != nil && err != http.ErrServerClosed {
			logger.Fatal("error while serving http", zap.String("port", port), zap.Error(err))
		}
	case <-ctx.Done():
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), time.Second*10)
		defer shutdownCancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Fatal("error while shutting down http server", zap.String("port", port), zap.Error(err))
		}
	}
}
```

### Step 4: Create HTTP Handler

Create `handler.go` to handle HTTP requests:

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

var startTime time.Time

func init() {
	startTime = time.Now()
}

type Handler struct {
	logger  *zap.Logger
	manager *Manager
}

func NewHandler(logger *zap.Logger, manager *Manager) *Handler {
	return &Handler{logger, manager}
}

func (h *Handler) Install(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaDataBodyOrErr(w, r)
	if err != nil {
		return
	}

	if err = h.manager.Install(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	h.responseMetaData(w, 201, metaData)
}

func (h *Handler) Uninstall(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaDataBodyOrErr(w, r)
	if err != nil {
		return
	}

	if err = h.manager.Uninstall(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.WriteHeader(204)
}

func (h *Handler) Sleep(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaDataBodyOrErr(w, r)
	if err != nil {
		return
	}

	if err = h.manager.Sleep(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	h.responseMetaData(w, 200, metaData)
}

func (h *Handler) Resume(w http.ResponseWriter, r *http.Request) {
	metaData, err := h.parseMetaDataBodyOrErr(w, r)
	if err != nil {
		return
	}

	if err = h.manager.Resume(r.Context(), metaData); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	h.responseMetaData(w, 200, metaData)
}

type HealthResponse struct {
	Timestamp string  `json:"timestamp"`
	Uptime    float64 `json:"uptime"`
	Message   string  `json:"message"`
	Healthy   bool    `json:"healthy"`
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime).Seconds()
	response := HealthResponse{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Uptime:    uptime,
		Message:   "Service is running",
		Healthy:   true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode health response", zap.Error(err), zap.Any("data", response))
	}
}

func (h *Handler) parseMetaDataBody(r *http.Request) (map[string]any, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %w", err)
	}
	defer func() { _ = r.Body.Close() }()

	data := make(map[string]any)
	if len(body) == 0 {
		return data, nil
	}

	err = json.Unmarshal(body, &data)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal request body: %w", err)
	}

	return data, nil
}

func (h *Handler) parseMetaDataBodyOrErr(w http.ResponseWriter, r *http.Request) (map[string]any, error) {
	metaData, err := h.parseMetaDataBody(r)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return nil, err
	}

	return metaData, nil
}

func (h *Handler) responseMetaData(w http.ResponseWriter, statusCode int, metaData map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(metaData); err != nil {
		h.logger.Error("Failed to encode metaData response", zap.Error(err), zap.Any("metaData", metaData))
	}
}
```

### Step 5: Implement Business Logic

Create `manager.go` with your custom lifecycle logic:

```go
package main

import (
	"context"

	"go.uber.org/zap"
)

type Manager struct {
	logger *zap.Logger
}

func NewManager(logger *zap.Logger) *Manager {
	return &Manager{logger}
}

func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Installing...", zap.Any("metaData", metaData))

	// TODO: Implement your installation logic here
	// - Create Kubernetes resources
	// - Configure applications
	// - Store state in metaData if needed

	return nil
}

func (m *Manager) Uninstall(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Uninstalling...", zap.Any("metaData", metaData))

	// TODO: Implement your uninstallation logic here
	// - Delete created resources
	// - Clean up external resources

	return nil
}

func (m *Manager) Sleep(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Sleeping...", zap.Any("metaData", metaData))

	// TODO: Implement your hibernation logic here
	// - Scale down deployments to 0
	// - Store current state in metaData

	return nil
}

func (m *Manager) Resume(ctx context.Context, metaData map[string]any) error {
	m.logger.Info("Resuming...", zap.Any("metaData", metaData))

	// TODO: Implement your resume logic here
	// - Restore state from metaData
	// - Scale up deployments

	return nil
}
```

### Step 6: Create Dockerfile

Create a `Dockerfile` to containerize your module:

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

### Step 7: Build the Docker Image

Build your custom module image:

```bash
docker build -t my-registry/my-module:v1.0.0 .
```

Push the image to a container registry:

```bash
docker push my-registry/my-module:v1.0.0
```

## Using Your Custom Module

### Create Resource Definition

Create a Custom resource definition YAML file:

```yaml
kind: Custom
metadata:
  name: my-module
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "My custom application module"
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

### Deploy the Module

Create a Module CRD that references your custom module:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
  namespace: default
spec:
  workspace:
    name: dev-workspace
    namespace: default
  source:
    raw:
      kind: Custom
      metadata:
        name: my-module
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        image: my-registry/my-module:v1.0.0
        permissions:
          - workspace
  config:
    namespace: my-namespace
    appName: my-application
    replicas: 3
```

## Working with Metadata

The metadata parameter in each endpoint is a JSON object that persists across lifecycle operations. Use it to store state information.

### Storing Data

In your Manager's Install method:

```go
func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
    // Store deployment name for later use
    deploymentName := "my-app-deployment"
    metaData["deploymentName"] = deploymentName

    // Store complex data
    metaData["installedResources"] = map[string]string{
        "deployment": deploymentName,
        "service": "my-app-service",
    }

    m.logger.Info("Installation completed", zap.String("deployment", deploymentName))
    return nil
}
```

### Retrieving Data

In your Manager's Uninstall method:

```go
func (m *Manager) Uninstall(ctx context.Context, metaData map[string]any) error {
    // Retrieve stored data
    deploymentName, ok := metaData["deploymentName"].(string)
    if !ok {
        return fmt.Errorf("deploymentName not found in metadata")
    }

    m.logger.Info("Deleting deployment", zap.String("name", deploymentName))

    // Your deletion logic here

    return nil
}
```

## Best Practices

### 1. Error Handling

Always return descriptive errors:

```go
func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
    deployment, err := m.createDeployment(ctx, metaData)
    if err != nil {
        return fmt.Errorf("failed to create deployment: %w", err)
    }

    metaData["deploymentName"] = deployment.Name
    return nil
}
```

### 2. Idempotency

Make all operations idempotent:

```go
func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
    // Check if already installed
    if deploymentName, ok := metaData["deploymentName"].(string); ok && deploymentName != "" {
        m.logger.Info("Deployment already exists", zap.String("name", deploymentName))
        return nil
    }

    // Create deployment
    // ...
}
```

### 3. Context Awareness

Respect context cancellation:

```go
func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        // Proceed with installation
    }

    // For long-running operations, check context periodically
}
```

### 4. Structured Logging

Use structured logging throughout:

```go
func (m *Manager) Install(ctx context.Context, metaData map[string]any) error {
    m.logger.Info("Starting installation",
        zap.Any("config", metaData),
    )

    // ... implementation ...

    m.logger.Info("Installation completed",
        zap.String("deploymentName", deploymentName),
    )

    return nil
}
```

### 5. Resource Cleanup

Always clean up resources in Uninstall:

```go
func (m *Manager) Uninstall(ctx context.Context, metaData map[string]any) error {
    // Retrieve all resources created during Install
    resources, ok := metaData["installedResources"].(map[string]any)
    if !ok {
        m.logger.Warn("No installed resources found in metadata")
        return nil
    }

    // Delete in reverse order of creation
    if svcName, ok := resources["service"].(string); ok {
        if err := m.deleteService(ctx, svcName); err != nil {
            return fmt.Errorf("failed to delete service: %w", err)
        }
    }

    if depName, ok := resources["deployment"].(string); ok {
        if err := m.deleteDeployment(ctx, depName); err != nil {
            return fmt.Errorf("failed to delete deployment: %w", err)
        }
    }

    return nil
}
```

### 6. Health Checks

Implement a robust health check:

```go
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
    // Check dependencies (database, external APIs, etc.)
    healthy := h.manager.CheckHealth(r.Context())

    response := HealthResponse{
        Timestamp: time.Now().UTC().Format(time.RFC3339),
        Uptime:    time.Since(startTime).Seconds(),
        Message:   "Service is running",
        Healthy:   healthy,
    }

    statusCode := 200
    if !healthy {
        statusCode = 503
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(response)
}
```

## Complete Example

See the complete example custom module in the repository:
- [Example Custom Module](https://github.com/forkspacer/modules/tree/main/custom/example)

## Next Steps

- [Development Overview](/development/overview/) - Learn about operator development
- [API Reference](/reference/crds/module/) - Understand Module CRD specification
- [Custom Resources](/reference/resources/custom/) - Custom resource definition reference

## Resources

- [Go HTTP Package](https://pkg.go.dev/net/http) - Go HTTP server documentation
- [Docker Documentation](https://docs.docker.com/) - Container build and deployment
- [Kubernetes Client-Go](https://github.com/kubernetes/client-go) - Kubernetes Go client library
- [Zap Logger](https://github.com/uber-go/zap) - Structured logging library
