---
title: Module
description: Module Custom Resource Definition reference
sidebar:
  order: 3
---

The `Module` resource represents an installable component or application that can be deployed into a `Workspace`. Modules reference resource definitions (Helm charts or custom modules) and support hibernation to reduce resource consumption.

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
  name: nginx-helm
  namespace: default
spec:
  workspace:
    name: dev-environment
    namespace: default
  source:
    httpURL: https://example.com/modules/nginx-helm.yaml
  config:
    replicas: 3
    environment: production
  hibernated: false
```

### Custom Module Example

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: custom-app
  namespace: default
spec:
  workspace:
    name: dev-environment
    namespace: default
  source:
    raw:
      kind: Custom
      metadata:
        name: custom-app
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        image: my-registry/custom-app:v1.0.0
```

## Spec Fields

The `.spec` field defines the desired state of the Module.

| Field        | Type    | Description                                                                                                     | Required              |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `source`     | object  | Source location of the module manifests. See [Source](#source).                                                 | Yes                   |
| `workspace`  | object  | Reference to the workspace where this module should be deployed. See [WorkspaceReference](#workspacereference). | Yes                   |
| `config`     | object  | Custom configuration for the module (arbitrary key-value pairs).                                                | No                    |
| `hibernated` | boolean | Whether the module should be in hibernated state.                                                               | No (default: `false`) |

### Source

The `source` field specifies where the resource definition should be loaded from. Resource definitions describe either Helm charts or custom modules with their configuration schemas. Only one source type should be specified.

| Field                 | Type   | Description                                                                                                            | Required |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| `raw`                 | object | Raw resource definition embedded directly in the Module resource.                                                      | No       |
| `configMap`           | object | Reference to a ConfigMap containing the resource definition. See [ConfigMapSource](#configmapsource).                  | No       |
| `httpURL`             | string | HTTP/HTTPS URL pointing to a resource definition YAML file.                                                            | No       |
| `existingHelmRelease` | object | Reference to an existing Helm release to adopt and track. See [ExistingHelmReleaseSource](#existinghelmreleasesource). | No       |

**Resource Definition Types:**

The source must point to or contain a resource definition with one of these kinds:

- **`Helm`**: Deploys a Helm chart - [Learn more →](/reference/resources/helm/)
- **`Custom`**: Runs a custom containerized module - [Learn more →](/reference/resources/custom/)

For complete details on resource definition structure and configuration, see the [Resources documentation](/reference/resources/overview/).

**Example - HTTP URL Source:**

```yaml
spec:
  source:
    httpURL: https://example.com/resources/postgresql.yaml
```

**Example - Raw Embedded Resource:**

```yaml
spec:
  source:
    raw:
      kind: Helm
      metadata:
        name: nginx
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        namespace: default
        repo: https://charts.bitnami.com/bitnami
        chartName: nginx
        version: 15.0.0
```

**Example - ConfigMap Source:**

```yaml
spec:
  source:
    configMap:
      name: redis-module-definition
      namespace: default
```

**Example - Existing Helm Release:**

```yaml
spec:
  source:
    existingHelmRelease:
      name: redis
      namespace: default
```

#### ConfigMapSource

The `configMap` source type references a Kubernetes ConfigMap that contains the resource definition.

| Field       | Type   | Description                 | Required                            |
| ----------- | ------ | --------------------------- | ----------------------------------- |
| `name`      | string | Name of the ConfigMap.      | Yes                                 |
| `namespace` | string | Namespace of the ConfigMap. | No (defaults to Module's namespace) |

The ConfigMap must contain a key named `module.yaml` with the resource definition as its value:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-module-definition
  namespace: default
data:
  module.yaml: |
    kind: Helm
    metadata:
      name: redis
      version: "1.0.0"
      supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
    spec:
      namespace: default
      repo: https://charts.bitnami.com/bitnami
      chartName: redis
      version: 21.2.9
```

#### ExistingHelmReleaseSource

The `existingHelmRelease` source type allows you to adopt and track existing Helm releases without reinstalling them. This is useful when you have pre-existing Helm releases in your cluster and want to manage them through Forkspacer without disruption.

| Field       | Type   | Description                                    | Required                   |
| ----------- | ------ | ---------------------------------------------- | -------------------------- |
| `name`      | string | Name of the existing Helm release.             | Yes                        |
| `namespace` | string | Namespace where the Helm release is installed. | No (defaults to `default`) |

**Important:** When a Module with an adopted Helm release is deleted, the underlying Helm release is **not** uninstalled. The Module only detaches from the release, leaving it running in the cluster.

### WorkspaceReference

The `workspace` field references the target workspace where the module will be deployed.

| Field       | Type   | Description                        | Required                |
| ----------- | ------ | ---------------------------------- | ----------------------- |
| `name`      | string | Name of the target workspace.      | Yes                     |
| `namespace` | string | Namespace of the target workspace. | No (default: `default`) |

**Example:**

```yaml
spec:
  workspace:
    name: production-workspace
    namespace: prod
```

### Config

The `config` field accepts key-value pairs for module-specific configuration. The available configuration options and their validation rules are defined in the resource definition's `config` array.

Configuration values are validated against the resource definition schema and passed to the underlying Helm chart or custom module. See the [Configuration Schema documentation](/reference/resources/overview/#configuration-schema) for details on supported configuration types and validation.

**Example:**

```yaml
spec:
  config:
    replicas: 5
    environment: staging
    enableMetrics: true
```

## Status Fields

The `.status` field reflects the observed state of the Module.

| Field          | Type               | Description                                                                                                              | Required |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| `phase`        | string             | Current phase of the module. Values: `ready`, `installing`, `uninstalling`, `sleeping`, `sleeped`, `resuming`, `failed`. | Yes      |
| `lastActivity` | string (date-time) | Timestamp of the last activity for this module.                                                                          | No       |
| `message`      | string             | Human-readable message about the current state.                                                                          | No       |
| `conditions`   | array              | Standard Kubernetes conditions. See [Conditions](#conditions).                                                           | No       |

### Conditions

Standard Kubernetes condition types used to represent the module state:

- **Available**: The module is fully functional and running.
- **Progressing**: The module is being installed, updated, or transitioning between states.
- **Degraded**: The module failed to reach or maintain its desired state.

Each condition has the following fields:

| Field                | Type               | Description                                                       |
| -------------------- | ------------------ | ----------------------------------------------------------------- |
| `type`               | string             | Condition type (e.g., "Available", "Progressing", "Degraded").    |
| `status`             | string             | Condition status: `True`, `False`, or `Unknown`.                  |
| `lastTransitionTime` | string (date-time) | Last time the condition transitioned.                             |
| `reason`             | string             | Programmatic identifier for the condition's last transition.      |
| `message`            | string             | Human-readable message explaining the condition.                  |
| `observedGeneration` | integer            | The `.metadata.generation` that the condition was set based upon. |

## Phase Values

The `status.phase` field can have the following values:

- **`ready`**: Module is successfully installed and operational.
- **`installing`**: Module is being installed into the workspace.
- **`uninstalling`**: Module is being removed from the workspace.
- **`sleeping`**: Module is transitioning to hibernated state.
- **`sleeped`**: Module is hibernated with resources scaled down.
- **`resuming`**: Module is waking up from hibernated state.
- **`failed`**: Module encountered an error during installation or operation.

## Usage Examples

### Installing a Helm Module from HTTP URL

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgresql
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://example.com/resources/postgresql-helm.yaml
  config:
    storageSize: "10Gi"
    enableBackups: true
```

### Installing a Custom Module with Configuration

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: custom-installer
spec:
  workspace:
    name: production-workspace
    namespace: prod
  source:
    httpURL: https://example.com/resources/installer.yaml
  config:
    environment: production
    debug: false
```

### Installing a Module with Raw Helm Definition

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis
spec:
  workspace:
    name: dev-environment
  source:
    raw:
      kind: Helm
      metadata:
        name: redis
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
        description: "Redis in-memory database"
      config:
        - type: string
          name: storageClass
          alias: storageClass
          spec:
            required: false
            default: "standard"
      spec:
        namespace: default
        repo: https://charts.bitnami.com/bitnami
        chartName: redis
        version: 18.0.0
        values:
          - raw:
              master:
                persistence:
                  storageClass: "{{ .config.storageClass }}"
  config:
    storageClass: "fast-ssd"
```

### Hibernating a Module

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: api-service
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://example.com/manifests/api.yaml
  hibernated: true
```

### Installing a Module from ConfigMap

```yaml
# First, create the ConfigMap with the module definition
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgresql-module
  namespace: default
data:
  module.yaml: |
    kind: Helm
    metadata:
      name: postgresql
      version: "1.0.0"
      supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
    spec:
      namespace: default
      repo: https://charts.bitnami.com/bitnami
      chartName: postgresql
      version: 12.0.0

---
# Then, create the Module referencing the ConfigMap
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgresql
  namespace: default
spec:
  workspace:
    name: dev-environment
  source:
    configMap:
      name: postgresql-module
      namespace: default
  config:
    storageSize: "10Gi"
```

### Adopting an Existing Helm Release

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: existing-redis
  namespace: default
spec:
  workspace:
    name: production-workspace
  source:
    existingHelmRelease:
      name: redis
      namespace: default
```

This Module will track the existing `redis` Helm release without reinstalling it. When the Module is deleted, the Helm release will remain running in the cluster.

## Module Lifecycle

1. **Installation**: When a Module is created, the operator fetches the resource definition from the specified source and processes it based on its kind (Helm or Custom).

2. **Configuration**: The `config` field can be used to parameterize the module installation. Configuration values are validated against the resource definition's config schema.

3. **Hibernation**: Setting `hibernated: true` scales down the module's resources to reduce costs while preserving the configuration.

4. **Updates**: Modifying the Module spec triggers an update in the workspace.

5. **Deletion**: Deleting a Module resource triggers uninstallation of the module from the workspace.

## Resource Definitions

Modules reference **resource definitions** that describe how applications should be installed. Resource definitions can be either:

- **Helm Resources**: Deploy Helm charts with customizable values
- **Custom Resources**: Run containerized custom modules for installation

For complete documentation on creating and using resource definitions, see:

- [Resources Overview](/reference/resources/overview/) - Introduction to resource definitions
- [Helm Resources](/reference/resources/helm/) - Helm chart deployments
- [Custom Resources](/reference/resources/custom/) - Container-based custom modules

## Relationship with Workspace

- A Module must reference an existing Workspace via the `workspace` field.
- Multiple Modules can be deployed to the same Workspace.
- When a Workspace is hibernated, all its Modules may be affected.
- If a Workspace is deleted, the operator's behavior for associated Modules depends on the finalization logic.

## Related Resources

- [Resources Overview](/reference/resources/overview/) - Resource definition documentation
- [Helm Resources](/reference/resources/helm/) - Helm resource reference
- [Custom Resources](/reference/resources/custom/) - Custom resource reference
