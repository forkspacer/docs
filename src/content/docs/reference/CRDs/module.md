---
title: Module
description: Module Custom Resource Definition reference
sidebar:
    order: 3
---

The `Module` resource represents an installable component or application that can be deployed into a `Workspace`. Modules can deploy Helm charts or run custom containerized modules, and support hibernation to reduce resource consumption.

## API Group and Version

- **API Group:** `batch.forkspacer.com`
- **API Version:** `v1`
- **Kind:** `Module`
- **Short Name:** `mo`

## Example

### Helm Module Example

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis
  namespace: default

config:
  - name: "Redis Version"
    alias: "version"
    option:
      editable: true
      required: false
      default: "21.2.9"
      values:
        - "21.2.9"
        - "21.2.7"
        - "21.2.6"

  - name: "Replica Count"
    alias: "replicaCount"
    integer:
      editable: true
      required: false
      default: 1
      min: 0
      max: 5

spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "{{.config.version}}"

    namespace: default

    values:
      - raw:
          replica:
            replicaCount: "{{.config.replicaCount}}"
          image:
            repository: bitnamilegacy/redis
          global:
            security:
              allowInsecureImages: true

    cleanup:
      removePVCs: true

  workspace:
    name: dev-environment
    namespace: default

  hibernated: false

  config:
    version: "21.2.7"
    replicaCount: 1
```

### Custom Module Example

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: custom-app
  namespace: default

spec:
  custom:
    image: my-registry/custom-app:v1.0.0
    permissions:
      - workspace

  workspace:
    name: dev-environment
    namespace: default

  hibernated: false
```

## Spec Fields

The `.spec` field defines the desired state of the Module.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `helm` | object | Helm chart deployment configuration. See [Helm](#helm). | No (mutually exclusive with `custom`) |
| `custom` | object | Custom module configuration for containerized HTTP services. See [Custom](#custom). | No (mutually exclusive with `helm`) |
| `workspace` | object | Reference to the workspace where this module should be deployed. See [WorkspaceReference](#workspacereference). | Yes |
| `config` | object | User-provided configuration values (arbitrary key-value pairs). | No |
| `hibernated` | boolean | Whether the module should be in hibernated state. | No (default: `false`) |

**Note:** Either `helm` or `custom` must be specified, but not both.

## Config Fields

The top-level `config` array defines user-configurable parameters with validation rules. Each configuration item specifies:

- **name**: Human-readable configuration name
- **alias**: The key used in `spec.config` to provide values
- **Type-specific spec**: One of: `string`, `integer`, `boolean`, `option`, or `multipleOptions`

### Configuration Types

#### String Configuration

```yaml
config:
  - name: "Database Host"
    alias: "dbHost"
    string:
      required: true
      default: "localhost"
      regex: "^[a-zA-Z0-9.-]+$"
      editable: true
```

**Fields:**
- `required` (boolean): Whether the field is required
- `default` (string): Default value
- `regex` (string): Validation regex pattern
- `editable` (boolean): Whether users can modify this value

#### Integer Configuration

```yaml
config:
  - name: "Replicas"
    alias: "replicas"
    integer:
      required: true
      default: 1
      min: 1
      max: 10
      editable: true
```

**Fields:**
- `required` (boolean): Whether the field is required
- `default` (integer): Default value
- `min` (integer): Minimum allowed value
- `max` (integer): Maximum allowed value
- `editable` (boolean): Whether users can modify this value

#### Boolean Configuration

```yaml
config:
  - name: "Enable Metrics"
    alias: "metrics"
    boolean:
      required: false
      default: false
      editable: true
```

**Fields:**
- `required` (boolean): Whether the field is required
- `default` (boolean): Default value
- `editable` (boolean): Whether users can modify this value

#### Option Configuration (Single Selection)

```yaml
config:
  - name: "Environment"
    alias: "env"
    option:
      required: true
      default: "development"
      values:
        - development
        - staging
        - production
      editable: true
```

**Fields:**
- `required` (boolean): Whether the field is required
- `default` (string): Default value (must be in values list)
- `values` (array): List of allowed values
- `editable` (boolean): Whether users can modify this value

#### Multiple Options Configuration

```yaml
config:
  - name: "Features"
    alias: "features"
    multipleOptions:
      required: false
      default:
        - logging
      values:
        - logging
        - metrics
        - tracing
        - profiling
      min: 1
      max: 3
      editable: true
```

**Fields:**
- `required` (boolean): Whether the field is required
- `default` (array): Default values (must be in values list)
- `values` (array): List of allowed values
- `min` (integer): Minimum number of selections
- `max` (integer): Maximum number of selections
- `editable` (boolean): Whether users can modify this value

### Using Configuration Values

Configuration values defined in the `config` array are provided by users in `spec.config` and can be referenced in Helm values or custom module configurations using Go templates:

```yaml
spec:
  helm:
    values:
      - raw:
          replicaCount: "{{.config.replicas}}"
          environment: "{{.config.env}}"
  config:
    replicas: 3
    env: "production"
```

## Helm

The `helm` field specifies Helm chart deployment configuration.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `chart` | object | Helm chart source specification. See [Chart](#chart). | Yes |
| `namespace` | string | Target Kubernetes namespace for the Helm release. Supports templating. | Yes |
| `releaseName` | string | Custom Helm release name (DNS-1035 compliant). Auto-generated if not specified. **Immutable after creation.** See [Release Names](#release-names). | No |
| `existingRelease` | object | Reference to an existing Helm release to adopt. See [ExistingRelease](#existingrelease). | No |
| `values` | array | Array of value sources (raw, file, configMap). | No |
| `outputs` | array | Output values to expose after installation. | No |
| `cleanup` | object | Cleanup behavior when module is deleted. | No |
| `migration` | object | Data migration configuration for workspace forking. | No |

### Chart

The `chart` field specifies where the Helm chart should be loaded from. Only one source type should be specified.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `repo` | object | Helm chart repository source. See [ChartRepo](#chartrepo). | No |
| `git` | object | Git repository source. See [ChartGit](#chartgit). | No |
| `configMap` | object | ConfigMap containing the chart archive. See [ChartConfigMap](#chartconfigmap). | No |

#### ChartRepo

Deploy a chart from a Helm repository:

```yaml
spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "21.2.9"
        auth:  # Optional for private repositories
          name: registry-credentials
          namespace: default
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `url` | string | Helm chart repository URL | Yes |
| `chart` | string | Name of the chart in the repository | Yes |
| `version` | string | Chart version to install. Supports templating. | No |
| `auth` | object | Authentication credentials for private repositories | No |
| `auth.name` | string | Name of the Secret containing credentials | Yes (if auth specified) |
| `auth.namespace` | string | Namespace of the Secret | No (default: `default`) |

#### ChartGit

Deploy a chart from a Git repository:

```yaml
spec:
  helm:
    chart:
      git:
        repo: https://github.com/org/charts-repo
        path: /charts/myapp
        revision: main
        auth:  # Optional for private repositories
          httpsSecretRef:
            name: git-credentials
            namespace: default
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `repo` | string | Git repository URL (https or ssh) | Yes |
| `path` | string | Path to the chart directory containing Chart.yaml | No (default: `/`) |
| `revision` | string | Git revision (branch, tag, commit SHA) | No (default: `main`) |
| `auth` | object | Authentication for private repositories | No |
| `auth.httpsSecretRef` | object | Reference to Secret with `username` and `token` fields | No |

#### ChartConfigMap

Deploy a chart from a ConfigMap:

```yaml
spec:
  helm:
    chart:
      configMap:
        name: redis-chart
        namespace: default
        key: chart.tgz
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the ConfigMap | Yes |
| `namespace` | string | Namespace of the ConfigMap | No (default: `default`) |
| `key` | string | Key containing the chart archive (`.tgz` file) | No (default: `chart.tgz`) |

### Release Names

The `releaseName` field allows you to specify a custom name for the Helm release. If not specified, Forkspacer automatically generates a unique release name.

**Auto-generated Release Names:**

When `releaseName` is not provided, the operator automatically generates a unique release name using the format:

```
<namespace>-<11-character-uuid>
```

For example: `default-a1b2c3d4e5f`

**Custom Release Names:**

You can specify a custom release name that must comply with DNS-1035 label standards:
- Start with a lowercase letter
- Contain only lowercase letters, numbers, and hyphens
- End with a lowercase letter or number
- Be 63 characters or less

```yaml
spec:
  helm:
    releaseName: my-custom-release
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
    namespace: default
```

**Important Notes:**
- The `releaseName` field is **immutable** after the Module is created
- Once set (either automatically or manually), it cannot be changed
- When adopting an existing release with `existingRelease`, the release name comes from `existingRelease.name` instead

### ExistingRelease

The `existingRelease` field allows you to adopt and track existing Helm releases without reinstalling them.

```yaml
spec:
  helm:
    existingRelease:
      name: redis
      namespace: default
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the existing Helm release | Yes |
| `namespace` | string | Namespace where the Helm release is installed | No (default: `default`) |

**Important:** When a Module with an adopted Helm release is deleted, the underlying Helm release is **not** uninstalled. The Module only detaches from the release, leaving it running in the cluster.

### Helm Values

The `values` field accepts an array of value sources. Multiple sources can be specified and will be merged in order.

#### Raw Values

Inline YAML values with template support:

```yaml
spec:
  helm:
    values:
      - raw:
          replicaCount: "{{.config.replicas}}"
          image:
            tag: "{{.config.imageTag}}"
```

#### File Values

HTTP/HTTPS URL to a values file:

```yaml
spec:
  helm:
    values:
      - file: https://example.com/helm-values/my-values.yaml
```

#### ConfigMap Values

Reference to a ConfigMap containing values:

```yaml
spec:
  helm:
    values:
      - configMap:
          name: helm-values
          namespace: default
          key: values.yaml  # Optional, defaults to "values.yaml"
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the ConfigMap | Yes |
| `namespace` | string | Namespace of the ConfigMap | No (default: `default`) |
| `key` | string | Key containing the values YAML | No (default: `values.yaml`) |

The values must be stored under the specified key (default: `values.yaml`) in the ConfigMap's data.

### Helm Outputs

Outputs allow you to expose values from the Helm release:

```yaml
spec:
  helm:
    outputs:
      - name: "Redis Password"
        valueFrom:
          secret:
            name: "{{.releaseName}}"
            key: redis-password
            namespace: default
      - name: "Redis Endpoint"
        value: "redis-master.default.svc.cluster.local:6379"
```

### Helm Cleanup

Configure cleanup behavior when the module is deleted:

```yaml
spec:
  helm:
    cleanup:
      removeNamespace: false
      removePVCs: true
```

### Helm Migration

Configure data migration for workspace forking:

```yaml
spec:
  helm:
    migration:
      pvcs:
        - "redis-data-{{.releaseName}}-master-0"
      secrets:
        - "{{.releaseName}}"
      configMaps:
        - "{{.releaseName}}-config"
```

## Custom

The `custom` field specifies a custom containerized module that implements an HTTP API for lifecycle management.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `image` | string | Docker image reference (e.g., `my-registry/my-module:v1.0.0`) | Yes |
| `imagePullSecrets` | array of strings | List of Kubernetes secret names for pulling private images | No |
| `permissions` | array of strings | Cluster access permissions: `workspace` or `controller` | No |

**Example:**

```yaml
spec:
  custom:
    image: my-registry/app-installer:v1.0.0
    imagePullSecrets:
      - my-registry-secret
    permissions:
      - workspace
```

### Permissions

- **`workspace`**: Provides the module with the kubeconfig file of the target workspace
- **`controller`**: Provides access to the main cluster via a service account (use with caution)

## WorkspaceReference

The `workspace` field references the target workspace where the module will be deployed.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the target workspace | Yes |
| `namespace` | string | Namespace of the target workspace | No (default: `default`) |

**Example:**

```yaml
spec:
  workspace:
    name: production-workspace
    namespace: prod
```

## Status Fields

The `.status` field reflects the observed state of the Module.

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Current phase: `ready`, `installing`, `uninstalling`, `sleeping`, `sleeped`, `resuming`, `failed` |
| `lastActivity` | string (date-time) | Timestamp of the last activity |
| `message` | string | Human-readable message about the current state |
| `source` | string | Source type of the module (e.g., `helm`, `custom`) |
| `conditions` | array | Standard Kubernetes conditions |

### Conditions

Standard Kubernetes condition types:

- **Available**: The module is fully functional and running
- **Progressing**: The module is being installed, updated, or transitioning
- **Degraded**: The module failed to reach or maintain its desired state

## Usage Examples

### Helm Module from Repository

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgresql
  namespace: default

config:
  - name: "Storage Size"
    alias: "storageSize"
    string:
      required: false
      default: "10Gi"
      regex: "^[0-9]+(Mi|Gi|Ti)$"

spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: postgresql
        version: "14.0.0"

    namespace: default

    values:
      - raw:
          persistence:
            size: "{{.config.storageSize}}"

  workspace:
    name: dev-environment

  config:
    storageSize: "20Gi"
```

### Helm Module from Git

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-app
  namespace: default

spec:
  helm:
    chart:
      git:
        repo: https://github.com/myorg/charts
        path: /charts/myapp
        revision: v1.0.0

    namespace: default

  workspace:
    name: dev-environment
```

### Helm Module with Custom Release Name

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-redis
  namespace: default

spec:
  helm:
    releaseName: prod-redis-primary  # Custom release name

    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "21.2.9"

    namespace: default

    values:
      - raw:
          fullnameOverride: "{{.releaseName}}"  # Uses the custom name

  workspace:
    name: production-workspace
```

This Module uses a custom release name instead of the auto-generated one. The `releaseName` is immutable after creation.

### Adopting an Existing Helm Release

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: existing-redis
  namespace: default

spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "21.2.9"

    existingRelease:
      name: redis
      namespace: default

    namespace: default

  workspace:
    name: production-workspace
```

This Module will track the existing `redis` Helm release without reinstalling it. When `existingRelease` is set, the release name comes from `existingRelease.name`.

### Custom Module

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: custom-installer
  namespace: default

config:
  - name: "Environment"
    alias: "env"
    option:
      required: true
      default: "development"
      values:
        - development
        - staging
        - production

spec:
  custom:
    image: my-registry/installer:v1.0.0
    permissions:
      - workspace

  workspace:
    name: dev-environment

  config:
    env: "production"
```

### Hibernating a Module

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: api-service
  namespace: default

spec:
  helm:
    chart:
      repo:
        url: https://charts.example.com
        chart: api-service
        version: "1.0.0"

    namespace: default

  workspace:
    name: dev-environment

  hibernated: true
```

## Module Lifecycle

1. **Installation**: When a Module is created, the operator processes either the Helm chart or custom module based on the spec.

2. **Configuration**: The `config` field provides user-supplied values that are validated against the configuration schema.

3. **Hibernation**: Setting `hibernated: true` scales down the module's resources to reduce costs while preserving configuration.

4. **Updates**: Modifying the Module spec triggers an update in the workspace.

5. **Deletion**: Deleting a Module resource triggers uninstallation (except for adopted Helm releases).

## Spec Rendering and Templating

The Module CRD supports powerful Go template rendering for both Helm and Custom module specs. The operator processes templates before deploying resources, enabling dynamic configuration based on validated user input.

### How Rendering Works

When a Module is processed, the operator:

1. **Validates Configuration**: Validates user-provided `spec.config` values against the `config` schema
2. **Determines Release Name** (Helm only): Uses the configured `releaseName` if provided, or the auto-generated unique name (format: `<namespace>-<11-char-uuid>`). For adopted releases, uses `existingRelease.name`.
3. **Renders Namespace** (Helm only): Renders the namespace field first with available context
4. **Renders Spec**: Recursively processes the entire spec, replacing template expressions with actual values
5. **Type Preservation**: Automatically converts numeric and boolean strings to their proper types

### Template Context

#### Helm Modules

Available template variables in Helm specs:

- **`.config.<alias>`**: User-provided configuration values (validated)
- **`.releaseName`**: The Helm release name - either custom-specified via `releaseName` field, auto-generated (e.g., `default-a1b2c3d4e5f`), or from `existingRelease.name` for adopted releases
- **`.namespace`**: Rendered namespace value (available in all fields except namespace itself)

#### Custom Modules

Available template variables in Custom specs:

- **`.config.<alias>`**: User-provided configuration values (validated)

### Template Syntax

Templates use Go's `text/template` syntax with `{{` and `}}` delimiters.

**Basic Substitution:**
```yaml
image: "myregistry/app:{{.config.version}}"
```

**Conditional Logic:**
```yaml
enabled: "{{ if eq .config.environment \"production\" }}true{{ else }}false{{ end }}"
```

**String Manipulation:**
```yaml
serviceName: "{{ .releaseName | lower }}-svc"
```

**Default Values:**
```yaml
storageClass: "{{ default \"standard\" .config.storageClass }}"
```

**Numeric Operations:**
```yaml
maxConnections: "{{ mul .config.replicas 10 }}"
```

### Template Functions

In addition to Go's standard template functions (like `default`, `eq`, `gt`, `mul`, etc.), Forkspacer provides custom functions for common use cases.

#### randBase62

Generates a random string using base62 characters (0-9, A-Z, a-z). Useful for creating unique identifiers, passwords, or tokens.

**Syntax:**
```yaml
{{ randBase62 <length> }}
```

**Parameters:**
- `length` (integer): The number of characters to generate

**Example:**
```yaml
spec:
  helm:
    values:
      - raw:
          # Generate a 16-character random API key
          apiKey: "{{ randBase62 16 }}"

          # Generate a 32-character random token
          token: "{{ randBase62 32 }}"

          # Generate a short random suffix
          instanceId: "app-{{ randBase62 8 }}"
```

**Output examples:**
```yaml
apiKey: "aB3dE5fG7hJ9kL2m"
token: "xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0rS"
instanceId: "app-xY7zA2bC"
```

**Note:** Each time the template is rendered, a new random value is generated. If you need consistent values across updates, use configuration values instead of `randBase62`.

### Type Preservation

The rendering engine automatically preserves types:

```yaml
# Template
replicaCount: "{{.config.replicas}}"  # String with template
enabled: "{{.config.enableFeature}}"   # String with template

# After rendering (if replicas=3, enableFeature=true)
replicaCount: 3      # Converted to integer
enabled: true        # Converted to boolean
```

This works because the renderer:
1. Executes the template to get a string result
2. Attempts to parse the result as JSON
3. Uses the parsed type if successful, otherwise keeps as string

### Rendering Examples

#### Helm Module with Full Templating

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgresql
  namespace: default

config:
  - name: "Environment"
    alias: "env"
    option:
      default: "development"
      values: ["development", "staging", "production"]

  - name: "Storage Size"
    alias: "storageSize"
    string:
      default: "10Gi"
      regex: "^[0-9]+(Mi|Gi|Ti)$"

  - name: "Replicas"
    alias: "replicas"
    integer:
      default: 1
      min: 1
      max: 5

spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: postgresql
        # Template in version
        version: "{{ if eq .config.env \"production\" }}14.0.0{{ else }}13.0.0{{ end }}"

    # Templated namespace
    namespace: "{{.config.env}}-database"

    values:
      - raw:
          # Templates with type preservation
          replication:
            enabled: "{{ if gt .config.replicas 1 }}true{{ else }}false{{ end }}"
            readReplicas: "{{ sub .config.replicas 1 }}"

          persistence:
            size: "{{.config.storageSize}}"

          # Using releaseName
          fullnameOverride: "{{.releaseName}}-db"

    outputs:
      - name: "Database Host"
        # Template in output value
        value: "{{.releaseName}}-postgresql.{{.namespace}}.svc.cluster.local"

  workspace:
    name: dev-environment

  config:
    env: "production"
    storageSize: "50Gi"
    replicas: 3
```

**After rendering, the Helm spec becomes:**
```yaml
helm:
  chart:
    repo:
      url: https://charts.bitnami.com/bitnami
      chart: postgresql
      version: "14.0.0"  # Conditional evaluated

  namespace: "production-database"  # Template rendered

  values:
    - raw:
        replication:
          enabled: true      # Type preserved as boolean
          readReplicas: 2    # Type preserved as integer
        persistence:
          size: "50Gi"
        fullnameOverride: "default-a1b2c3d4e5f-db"  # Using auto-generated releaseName

  outputs:
    - name: "Database Host"
      value: "default-a1b2c3d4e5f-postgresql.production-database.svc.cluster.local"  # Using auto-generated releaseName
```

#### Custom Module with Templating

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: app-installer
  namespace: default

config:
  - name: "Application Version"
    alias: "version"
    string:
      default: "v1.0.0"

  - name: "Debug Mode"
    alias: "debug"
    boolean:
      default: false

spec:
  custom:
    # Templated image tag
    image: "my-registry/installer:{{.config.version}}"

    permissions:
      - workspace

  workspace:
    name: dev-environment

  config:
    version: "v2.1.0"
    debug: true
```

**After rendering:**
```yaml
custom:
  image: "my-registry/installer:v2.1.0"
  permissions:
    - workspace
```

### Namespace Rendering in Helm Modules

The namespace field has special rendering behavior:

1. **First Pass**: Renders namespace with `releaseName` and `config`
2. **Second Pass**: Renders the rest of the spec with `releaseName`, `config`, and the rendered `namespace`

This allows namespace to be templated and then used in other template expressions:

```yaml
spec:
  helm:
    namespace: "{{.config.env}}-apps"

    values:
      - raw:
          ingress:
            # Can use the rendered namespace value
            host: "app.{{.namespace}}.example.com"
```

### Effective Namespace and Release Name

When working with Helm modules, especially with adopted releases, Forkspacer uses helper methods to determine the effective namespace and release name.

#### GetNamespace() Method

When `existingRelease` is specified, the effective namespace is determined by `GetNamespace()`:

- If `existingRelease` is set: returns `existingRelease.namespace`
- Otherwise: returns `helm.namespace`

This ensures proper namespace handling for adopted Helm releases.

#### GetReleaseName() Method

The effective release name is determined by `GetReleaseName()`:

- If `existingRelease` is set: returns `existingRelease.name` (for adopted releases)
- Otherwise: returns `helm.releaseName` (either custom or auto-generated)

This ensures that templates always have access to the correct release name through `.releaseName`, regardless of whether the release is newly created or adopted.

### Best Practices for Templating

1. **Always quote template expressions**: Use `"{{.config.value}}"` to ensure valid YAML
2. **Use type-aware templates**: The renderer preserves types, so `"{{.config.replicas}}"` becomes an integer
3. **Validate early**: Configuration validation happens before rendering, catching errors early
4. **Use meaningful defaults**: Provide sensible defaults in config schema
5. **Document templates**: Add comments explaining complex template logic
6. **Test with different configs**: Verify templates work with various configuration values
7. **Avoid nested quotes**: Template output shouldn't contain quotes if you're already quoting the template

## Relationship with Workspace

- A Module must reference an existing Workspace via the `workspace` field
- Multiple Modules can be deployed to the same Workspace
- When a Workspace is hibernated, all its Modules may be affected
- If a Workspace is deleted, the operator's behavior for associated Modules depends on finalization logic

## Related Resources

- [Workspace CRD](/reference/crds/workspace/) - Workspace resource reference
