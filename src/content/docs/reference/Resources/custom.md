---
title: Custom
description: Custom resource definition reference for plugin-based installations
sidebar:
    order: 3
---

# Custom Resources

Custom resources define Go plugin-based installations that can be executed within a Module. They provide a flexible way to run custom installation, configuration, and management logic using compiled Go plugins that integrate directly with the operator.

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
  repo:
    file: <http-url-to-plugin.so>
    # OR
    configMap:
      name: <configmap-name>
      namespace: <configmap-namespace>
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

### Repo

The `repo` field specifies where the compiled Go plugin (`.so` file) is located. **Only one of `file` or `configMap` should be specified.**

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `repo.file` | string | HTTP/HTTPS URL to the compiled plugin `.so` file | One of file or configMap |
| `repo.configMap` | object | Reference to a ConfigMap containing the plugin binary | One of file or configMap |
| `repo.configMap.name` | string | Name of the ConfigMap | Yes (if using configMap) |
| `repo.configMap.namespace` | string | Namespace of the ConfigMap | No (defaults to module namespace) |

**Note**: When using `file`, the URL must point to a downloadable `.so` binary file. When using `configMap`, the plugin binary must be stored under the key `plugin` in the ConfigMap's data.

## Go Plugin Interface

Custom plugins are compiled Go plugins (`.so` files) that implement the `IManager` interface. The operator loads these plugins dynamically at runtime.

### Required Interface

All custom plugins must implement the `IManager` interface from `github.com/forkspacer/forkspacer/pkg/manager/base`:

```go
type IManager interface {
    Install(ctx context.Context, metaData MetaData) error
    Uninstall(ctx context.Context, metaData MetaData) error
    Sleep(ctx context.Context, metaData MetaData) error
    Resume(ctx context.Context, metaData MetaData) error
}
```

### Plugin Constructor

Plugins must export a constructor function named `NewManager` with this signature:

```go
func NewManager(
    ctx context.Context,
    logger logr.Logger,
    kubernetesConfig *rest.Config,
    config map[string]any,
) (base.IManager, error)
```

**Parameters:**
- `ctx`: Context for the plugin lifecycle
- `logger`: Structured logger for plugin output
- `kubernetesConfig`: Kubernetes REST config for cluster access
- `config`: User-provided configuration values from the Module CRD

### Lifecycle Methods

#### Install

Called when a Module is created or needs to be installed:

```go
func (plugin MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
    plugin.logger.Info("Installing module")
    // Installation logic here
    return nil
}
```

#### Uninstall

Called when a Module is deleted:

```go
func (plugin MyPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
    plugin.logger.Info("Uninstalling module")
    // Cleanup logic here
    return nil
}
```

#### Sleep

Called when a Module is hibernated:

```go
func (plugin MyPlugin) Sleep(ctx context.Context, metaData base.MetaData) error {
    plugin.logger.Info("Hibernating module")
    // Scale down resources
    return nil
}
```

#### Resume

Called when a Module is resumed from hibernation:

```go
func (plugin MyPlugin) Resume(ctx context.Context, metaData base.MetaData) error {
    plugin.logger.Info("Resuming module")
    // Scale up resources
    return nil
}
```

### Configuration Access

Configuration values are passed to the `NewManager` constructor as a `map[string]any`:

```go
func NewManager(
    ctx context.Context,
    logger logr.Logger,
    kubernetesConfig *rest.Config,
    config map[string]any,
) (base.IManager, error) {
    // Access configuration values
    replicas := config["replicas"].(int)
    environment := config["env"].(string)

    logger.Info("Configuration", "replicas", replicas, "environment", environment)

    return &MyPlugin{
        logger: logger,
        config: config,
    }, nil
}
```

### Error Handling

- Return `nil` for successful operations
- Return an `error` for failures (module will be marked as failed)
- Use the provided logger for debugging and status messages

## Examples

### Complete Plugin Example

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
  repo:
    file: https://example.com/plugins/custom-app/plugin.so
```

**Plugin Implementation** (`plugins/custom-app/main.go`):

```go
package main

import (
	"context"
	"fmt"

	"github.com/go-logr/logr"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/forkspacer/forkspacer/pkg/manager/base"
)

// Ensure the plugin implements the interface
var _ base.NewCustomManagerT = NewManager

// NewManager is the required constructor function
func NewManager(
	ctx context.Context,
	logger logr.Logger,
	kubernetesConfig *rest.Config,
	config map[string]any,
) (base.IManager, error) {
	kubernetesClient, err := kubernetes.NewForConfig(kubernetesConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	// Extract configuration values
	environment := config["env"].(string)
	debug := config["debug"].(bool)
	namespace := config["namespace"].(string)

	logger.Info("Initializing plugin",
		"environment", environment,
		"debug", debug,
		"namespace", namespace,
	)

	return &CustomAppPlugin{
		logger:    logger,
		k8sClient: kubernetesClient,
		env:       environment,
		debug:     debug,
		namespace: namespace,
	}, nil
}

type CustomAppPlugin struct {
	logger    logr.Logger
	k8sClient *kubernetes.Clientset
	env       string
	debug     bool
	namespace string
}

func (plugin *CustomAppPlugin) Install(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Installing custom application",
		"environment", plugin.env,
		"namespace", plugin.namespace,
	)

	// Create namespace if it doesn't exist
	_, err := plugin.k8sClient.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: plugin.namespace,
		},
	}, metav1.CreateOptions{})
	if err != nil && !errors.IsAlreadyExists(err) {
		return fmt.Errorf("failed to create namespace: %w", err)
	}

	// Apply base manifests
	plugin.logger.Info("Applying base manifests")
	// ... deployment logic here ...

	// Apply environment-specific configuration
	plugin.logger.Info("Applying environment configuration", "env", plugin.env)
	// ... environment-specific logic ...

	if plugin.debug {
		plugin.logger.Info("Applying debug configuration")
		// ... debug configuration ...
	}

	plugin.logger.Info("Installation completed successfully")
	return nil
}

func (plugin *CustomAppPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Uninstalling custom application", "namespace", plugin.namespace)

	// Delete resources
	// ... cleanup logic ...

	plugin.logger.Info("Uninstallation completed successfully")
	return nil
}

func (plugin *CustomAppPlugin) Sleep(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Hibernating custom application")

	// Scale down deployments
	// ... hibernation logic ...

	return nil
}

func (plugin *CustomAppPlugin) Resume(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Resuming custom application")

	// Scale up deployments
	// ... resume logic ...

	return nil
}

// Required empty main function for Go plugins
func main() {}
```

### Simple Plugin Example

**Resource Definition:**

```yaml
kind: Custom
metadata:
  name: test-plugin
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "Simple test plugin"

spec:
  repo:
    file: https://example.com/plugins/test/plugin.so
```

**Plugin Implementation:**

```go
package main

import (
	"context"

	"github.com/go-logr/logr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/forkspacer/forkspacer/pkg/manager/base"
)

var _ base.NewCustomManagerT = NewManager

func NewManager(
	ctx context.Context,
	logger logr.Logger,
	kubernetesConfig *rest.Config,
	config map[string]any,
) (base.IManager, error) {
	kubernetesClient, err := kubernetes.NewForConfig(kubernetesConfig)
	if err != nil {
		return nil, err
	}

	return TestPlugin{log: logger, kubernetesClient: kubernetesClient}, nil
}

type TestPlugin struct {
	log              logr.Logger
	kubernetesClient *kubernetes.Clientset
}

func (plugin TestPlugin) Install(ctx context.Context, metaData base.MetaData) error {
	plugin.log.Info("Install 'Test' custom plugin")
	return nil
}

func (plugin TestPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
	plugin.log.Info("Uninstall 'Test' custom plugin")
	return nil
}

func (plugin TestPlugin) Sleep(ctx context.Context, metaData base.MetaData) error {
	plugin.log.Info("Sleep 'Test' custom plugin")
	return nil
}

func (plugin TestPlugin) Resume(ctx context.Context, metaData base.MetaData) error {
	plugin.log.Info("Resume 'Test' custom plugin")
	return nil
}

func main() {}
```

## Creating a Plugin from Scratch

This guide walks you through creating a custom plugin from start to finish.

### Step 1: Clone the Forkspacer Repository

```bash
git clone https://github.com/forkspacer/forkspacer
cd forkspacer
```

### Step 2: Create Plugin Directory

Create a new directory for your plugin in the `plugins` folder:

```bash
mkdir -p plugins/my-plugin
```

### Step 3: Create the Plugin Code

Create a `main.go` file in your plugin directory:

```bash
cd plugins/my-plugin
```

**`plugins/my-plugin/main.go`:**

```go
package main

import (
	"context"
	"fmt"

	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/forkspacer/forkspacer/pkg/manager/base"
)

// Ensure the plugin implements the required interface
var _ base.NewCustomManagerT = NewManager

// NewManager is the required constructor function
func NewManager(
	ctx context.Context,
	logger logr.Logger,
	kubernetesConfig *rest.Config,
	config map[string]any,
) (base.IManager, error) {
	// Create Kubernetes clients
	kubernetesClient, err := kubernetes.NewForConfig(kubernetesConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(kubernetesConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Extract configuration values
	namespace := config["namespace"].(string)
	appName := config["appName"].(string)
	replicas := int32(config["replicas"].(int))

	logger.Info("Initializing my-plugin",
		"namespace", namespace,
		"appName", appName,
		"replicas", replicas,
	)

	return &MyPlugin{
		logger:        logger,
		k8sClient:     kubernetesClient,
		dynamicClient: dynamicClient,
		namespace:     namespace,
		appName:       appName,
		replicas:      replicas,
	}, nil
}

type MyPlugin struct {
	logger        logr.Logger
	k8sClient     *kubernetes.Clientset
	dynamicClient dynamic.Interface
	namespace     string
	appName       string
	replicas      int32
}

func (plugin *MyPlugin) Install(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Installing application",
		"namespace", plugin.namespace,
		"appName", plugin.appName,
	)

	// Create namespace if it doesn't exist
	_, err := plugin.k8sClient.CoreV1().Namespaces().Get(ctx, plugin.namespace, metav1.GetOptions{})
	if err != nil {
		plugin.logger.Info("Creating namespace", "namespace", plugin.namespace)
		_, err = plugin.k8sClient.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: plugin.namespace,
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create namespace: %w", err)
		}
	}

	// Create a deployment using dynamic client
	deployment := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "apps/v1",
			"kind":       "Deployment",
			"metadata": map[string]interface{}{
				"name":      plugin.appName,
				"namespace": plugin.namespace,
			},
			"spec": map[string]interface{}{
				"replicas": plugin.replicas,
				"selector": map[string]interface{}{
					"matchLabels": map[string]interface{}{
						"app": plugin.appName,
					},
				},
				"template": map[string]interface{}{
					"metadata": map[string]interface{}{
						"labels": map[string]interface{}{
							"app": plugin.appName,
						},
					},
					"spec": map[string]interface{}{
						"containers": []interface{}{
							map[string]interface{}{
								"name":  plugin.appName,
								"image": "nginx:latest",
								"ports": []interface{}{
									map[string]interface{}{
										"containerPort": 80,
									},
								},
							},
						},
					},
				},
			},
		},
	}

	deploymentRes := schema.GroupVersionResource{
		Group:    "apps",
		Version:  "v1",
		Resource: "deployments",
	}

	_, err = plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Create(
		ctx, deployment, metav1.CreateOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to create deployment: %w", err)
	}

	plugin.logger.Info("Installation completed successfully")
	return nil
}

func (plugin *MyPlugin) Uninstall(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Uninstalling application", "namespace", plugin.namespace)

	deploymentRes := schema.GroupVersionResource{
		Group:    "apps",
		Version:  "v1",
		Resource: "deployments",
	}

	err := plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Delete(
		ctx, plugin.appName, metav1.DeleteOptions{},
	)
	if err != nil {
		plugin.logger.Error(err, "Failed to delete deployment")
		return fmt.Errorf("failed to delete deployment: %w", err)
	}

	plugin.logger.Info("Uninstallation completed successfully")
	return nil
}

func (plugin *MyPlugin) Sleep(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Hibernating application")

	deploymentRes := schema.GroupVersionResource{
		Group:    "apps",
		Version:  "v1",
		Resource: "deployments",
	}

	// Scale deployment to 0
	deployment, err := plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Get(
		ctx, plugin.appName, metav1.GetOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to get deployment: %w", err)
	}

	unstructured.SetNestedField(deployment.Object, int64(0), "spec", "replicas")

	_, err = plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Update(
		ctx, deployment, metav1.UpdateOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to scale down deployment: %w", err)
	}

	plugin.logger.Info("Hibernation completed successfully")
	return nil
}

func (plugin *MyPlugin) Resume(ctx context.Context, metaData base.MetaData) error {
	plugin.logger.Info("Resuming application")

	deploymentRes := schema.GroupVersionResource{
		Group:    "apps",
		Version:  "v1",
		Resource: "deployments",
	}

	// Scale deployment back to original replicas
	deployment, err := plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Get(
		ctx, plugin.appName, metav1.GetOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to get deployment: %w", err)
	}

	unstructured.SetNestedField(deployment.Object, int64(plugin.replicas), "spec", "replicas")

	_, err = plugin.dynamicClient.Resource(deploymentRes).Namespace(plugin.namespace).Update(
		ctx, deployment, metav1.UpdateOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to scale up deployment: %w", err)
	}

	plugin.logger.Info("Resume completed successfully")
	return nil
}

// Required empty main function for Go plugins
func main() {}
```

### Step 4: Build the Plugin

Return to the forkspacer root directory and build the plugin using Make:

```bash
cd ../..  # Return to forkspacer root
make build-plugin PLUGIN=my-plugin
```

This will:
1. Build the plugin using Docker with the correct Go version and settings
2. Compile with CGO enabled and `-buildmode=plugin`
3. Output the compiled plugin to `plugins/my-plugin/plugin.so`

**Output:**
```
Building plugin 'my-plugin' in Docker container...
Plugin built successfully: plugins/my-plugin/plugin.so
Plugin size: 15M
```

### Step 5: Create Resource Definition

Create a resource definition YAML file for your plugin:

**`my-plugin-resource.yaml`:**

```yaml
kind: Custom
metadata:
  name: my-plugin
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  description: "My custom application plugin"
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
  repo:
    file: https://your-server.com/plugins/my-plugin/plugin.so
```

### Step 6: Deploy the Plugin

1. **Host the plugin binary** on an HTTP server or object storage
2. **Create a Module** that uses your plugin:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
spec:
  workspace:
    name: dev-workspace
  source:
    httpURL: https://your-server.com/resources/my-plugin-resource.yaml
  config:
    namespace: my-namespace
    appName: my-application
    replicas: 3
```

### Build Requirements

**Important considerations:**

1. **Go Version**: Must match the operator's Go version
2. **CGO**: Must be enabled (`CGO_ENABLED=1`)
3. **Build Mode**: Must use `-buildmode=plugin`
4. **Dependencies**: Plugin must have access to the same dependencies as the operator
5. **Platform**: Plugin must be built for the same OS/architecture as the operator

## Plugin Distribution

After building plugins, they need to be made accessible to the operator via HTTP/HTTPS URLs.

### Hosting Options

**Static File Server:**
```bash
# Serve plugins directory via HTTP
cd plugins
python3 -m http.server 8080

# Access at: http://localhost:8080/test/plugin.so
```

**Object Storage:**
- Amazon S3
- Google Cloud Storage
- Azure Blob Storage
- MinIO

**Web Server:**
- Nginx
- Apache
- GitHub Releases

### Example Distribution Setup

**Resource Definition:**
```yaml
kind: Custom
metadata:
  name: my-plugin
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
spec:
  repo:
    file: https://releases.example.com/plugins/my-plugin/v1.0.0/plugin.so
```

**Hosting on GitHub Releases:**
```yaml
spec:
  repo:
    file: https://github.com/org/repo/releases/download/v1.0.0/plugin.so
```

**Hosting on Object Storage:**
```yaml
spec:
  repo:
    file: https://storage.googleapis.com/my-bucket/plugins/my-plugin/plugin.so
```

### ConfigMap Distribution

For internal or private plugins, use ConfigMaps:

```bash
# Create ConfigMap from plugin binary
kubectl create configmap my-plugin \
  --from-file=plugin=/path/to/plugin.so \
  --namespace=default
```

**Resource Definition:**
```yaml
kind: Custom
metadata:
  name: my-plugin
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
spec:
  repo:
    configMap:
      name: my-plugin
      namespace: default
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
        repo:
          file: https://example.com/plugins/app-installer/plugin.so
  config:
    namespace: my-namespace
```

## Best Practices

### Plugin Development

1. **Interface Implementation**: Always implement all four methods (Install, Uninstall, Sleep, Resume)
2. **Error Handling**: Return meaningful errors with context
3. **Logging**: Use structured logging with the provided logger
4. **Idempotency**: Ensure operations can be safely retried
5. **Context Handling**: Respect context cancellation signals
6. **Configuration Validation**: Validate configuration in the NewManager function
7. **Resource Cleanup**: Properly clean up resources in Uninstall

### Building and Testing

1. **Build Consistency**: Always use the Makefile or Docker build process
2. **Version Compatibility**: Ensure plugin is built with matching operator version
3. **Testing**: Test plugins in isolation before deployment
4. **Dependencies**: Minimize external dependencies
5. **Binary Size**: Keep plugin binaries small and efficient

### Deployment

1. **Security**: Avoid hardcoding secrets; use Kubernetes secrets
2. **Distribution**: Host plugins on accessible HTTP/HTTPS URLs or ConfigMaps
3. **Version Control**: Keep source code in version control
4. **Documentation**: Document plugin behavior and configuration
5. **Monitoring**: Include appropriate logging for observability
6. **Versioning**: Use versioned URLs for plugin distribution (e.g., `/v1.0.0/plugin.so`)

### Configuration Design

1. **Type Safety**: Use appropriate configuration types with validation
2. **Defaults**: Provide sensible default values
3. **Validation**: Use regex and constraints for input validation
4. **Editability**: Mark sensitive fields as non-editable when appropriate

## Related Resources

- [Helm Resources](./helm.md) - Helm chart-based resources
- [Overview](./overview.md) - Resource definitions overview
- [Module CRD](/reference/crds/module/) - Using resources in Modules
