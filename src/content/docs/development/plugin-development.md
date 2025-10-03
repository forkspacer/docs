---
title: Plugin Development
description: Guide for creating custom plugins for the Forkspacer operator
sidebar:
  order: 2
---

# Plugin Development

Forkspacer supports a plugin system that allows you to extend the operator with custom resource management logic. Plugins enable you to integrate third-party tools, implement custom deployment strategies, or handle specialized workloads beyond the built-in Helm and Kubernetes manifest support.

## What are Plugins?

Plugins are Go shared libraries (`.so` files) that implement the `IManager` interface. They are dynamically loaded by the operator at runtime and provide custom lifecycle management for Module resources.

### Plugin Capabilities

A plugin must implement four core lifecycle methods:

- **Install**: Deploy and configure resources
- **Uninstall**: Remove resources and clean up
- **Sleep**: Hibernate or scale down resources
- **Resume**: Wake up or scale up resources

## Plugin Architecture

### Interface Definition

All plugins must implement the `base.IManager` interface:

```go
type IManager interface {
    Install(ctx context.Context, metaData MetaData) error
    Uninstall(ctx context.Context, metaData MetaData) error
    Sleep(ctx context.Context, metaData MetaData) error
    Resume(ctx context.Context, metaData MetaData) error
}
```

### Plugin Factory Function

Each plugin must export a `NewManager` function with this exact signature:

```go
func NewManager(
    ctx context.Context,
    logger logr.Logger,
    kubernetesConfig *rest.Config,
    config map[string]any,
) (base.IManager, error)
```

This function is called when the operator loads your plugin and should return an instance that implements `IManager`.

## Creating a Plugin

### Step 1: Create Plugin Directory

Create a directory for your plugin under `plugins/`:

```bash
mkdir -p plugins/my-plugin
```

### Step 2: Write Plugin Code

Create `plugins/my-plugin/main.go`:

```go
package main

import (
    "context"
    "fmt"

    "github.com/go-logr/logr"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"

    "github.com/forkspacer/forkspacer/pkg/manager/base"
)

// Ensure your plugin implements the required factory function type
var _ base.NewCustomManagerT = NewManager

// NewManager is the entry point for the plugin
func NewManager(
    ctx context.Context,
    logger logr.Logger,
    kubernetesConfig *rest.Config,
    config map[string]any,
) (base.IManager, error) {
    // Initialize Kubernetes client
    kubernetesClient, err := kubernetes.NewForConfig(kubernetesConfig)
    if err != nil {
        return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
    }

    // Parse plugin configuration
    appName, ok := config["appName"].(string)
    if !ok || appName == "" {
        appName = "default-app"
    }

    return &MyPlugin{
        log:              logger,
        kubernetesClient: kubernetesClient,
        appName:          appName,
    }, nil
}

// MyPlugin implements the IManager interface
type MyPlugin struct {
    log              logr.Logger
    kubernetesClient *kubernetes.Clientset
    appName          string
}

func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    p.log.Info("Installing custom application", "app", p.appName)

    // Your custom installation logic here
    // - Create deployments, services, configmaps, etc.
    // - Store state in metaData if needed for later operations

    return nil
}

func (p *MyPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
    p.log.Info("Uninstalling custom application", "app", p.appName)

    // Your custom uninstallation logic here
    // - Delete resources created during Install
    // - Clean up any external resources

    return nil
}

func (p *MyPlugin) Sleep(ctx context.Context, metaData base.MetaData) error {
    p.log.Info("Hibernating custom application", "app", p.appName)

    // Your custom hibernation logic here
    // - Scale down deployments
    // - Store current state in metaData
    // - Suspend resources

    return nil
}

func (p *MyPlugin) Resume(ctx context.Context, metaData base.MetaData) error {
    p.log.Info("Resuming custom application", "app", p.appName)

    // Your custom resume logic here
    // - Restore state from metaData
    // - Scale up deployments
    // - Resume suspended resources

    return nil
}

// Required: empty main function for plugin build
func main() {}
```

### Step 3: Build the Plugin

Use the Makefile target to build your plugin:

```bash
make build-plugin PLUGIN=my-plugin
```

This command:
1. Builds the plugin in a Docker container with the same Go version as the operator
2. Compiles the plugin as a shared library (`.so`)
3. Extracts the plugin to `plugins/my-plugin/plugin.so`

**Output:**
```
Building plugin 'my-plugin' in Docker container...
Plugin built successfully: plugins/my-plugin/plugin.so
Plugin size: 15M
```

## Using Your Plugin

### Option 1: From HTTP URL

Host your plugin file and reference it via HTTP:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-custom-app
  namespace: default
spec:
  workspace:
    name: dev-workspace
    namespace: default

  source:
    raw:
      kind: Custom
      spec:
        repo:
          file: "https://example.com/plugins/my-plugin.so"
```

### Option 2: From ConfigMap

Store the plugin in a ConfigMap and reference it:

1. **Create ConfigMap with plugin binary:**

```bash
kubectl create configmap my-plugin-cm \
  --from-file=plugin=plugins/my-plugin/plugin.so \
  -n default
```

2. **Reference in Module:**

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-custom-app
  namespace: default
spec:
  workspace:
    name: dev-workspace
    namespace: default

  source:
    raw:
      kind: Custom
      spec:
        repo:
          configMap:
            name: my-plugin-cm
            namespace: default
```

## Working with MetaData

The `MetaData` parameter in each method is a persistent key-value store that survives across reconciliation cycles. Use it to store state information.

### Storing Data

```go
func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    // Store deployment name for later use
    deploymentName := "my-app-deployment"
    metaData["deploymentName"] = deploymentName

    // Store complex data as JSON-serializable maps
    metaData["installedResources"] = map[string]string{
        "deployment": deploymentName,
        "service": "my-app-service",
    }

    return nil
}
```

### Retrieving Data

```go
func (p *MyPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
    // Retrieve simple string
    deploymentName := metaData.DecodeToString("deploymentName")

    // Retrieve complex data
    var resources map[string]string
    if err := mapstructure.Decode(metaData["installedResources"], &resources); err != nil {
        return fmt.Errorf("failed to decode resources: %w", err)
    }

    // Use the data
    p.log.Info("Deleting deployment", "name", deploymentName)

    return nil
}
```

## Best Practices

### 1. Error Handling

Always return descriptive errors:

```go
func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    deployment, err := p.createDeployment(ctx)
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
func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    // Check if already installed
    deploymentName := metaData.DecodeToString("deploymentName")
    if deploymentName != "" {
        p.log.Info("Deployment already exists", "name", deploymentName)
        return nil
    }

    // Create deployment
    // ...
}
```

### 3. Context Awareness

Respect context cancellation:

```go
func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
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

Use structured logging with the provided logger:

```go
func (p *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    p.log.Info("Starting installation",
        "app", p.appName,
        "namespace", p.namespace,
    )

    // ...

    p.log.Info("Installation completed",
        "app", p.appName,
        "deploymentName", deploymentName,
    )
}
```

### 5. Resource Cleanup

Always clean up resources in Uninstall:

```go
func (p *MyPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
    // Get all resources created during Install
    resources := metaData["installedResources"].(map[string]string)

    // Delete in reverse order of creation
    if svcName, ok := resources["service"]; ok {
        if err := p.deleteService(ctx, svcName); err != nil {
            return fmt.Errorf("failed to delete service: %w", err)
        }
    }

    if depName, ok := resources["deployment"]; ok {
        if err := p.deleteDeployment(ctx, depName); err != nil {
            return fmt.Errorf("failed to delete deployment: %w", err)
        }
    }

    return nil
}
```

## Next Steps

- [Development Overview](/development/overview/) - Learn about operator development
- [API Reference](/reference/crds/module/) - Understand Module CRD specification
- [Examples](https://github.com/forkspacer/forkspacer/tree/main/plugins) - Browse example plugins

## Resources

- [Go Plugin Package](https://pkg.go.dev/plugin) - Official Go plugin documentation
- [Kubernetes Client-Go](https://github.com/kubernetes/client-go) - Kubernetes Go client library
- [logr](https://github.com/go-logr/logr) - Structured logging interface
