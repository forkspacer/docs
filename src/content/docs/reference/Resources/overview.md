---
title: Overview
description: Overview of Resource types and common configuration patterns
sidebar:
  order: 1
---

# Resources Overview

Resources are YAML definition files that describe how modules should be installed and configured within a workspace. They provide a declarative way to define Helm charts or custom modules with user-configurable parameters.

## Resource Types

The forkspacer operator supports two types of resources:

### Helm Resources

[Helm resources](/reference/resources/helm/) deploy Helm charts from repositories with customizable values and configuration options. They provide:

- Integration with Helm chart repositories
- Template-based value injection
- Configuration validation
- Output value exposure
- Cleanup policies

**Use Cases:**
- Deploying standard applications from Helm charts
- Database deployments (PostgreSQL, MySQL, Redis, etc.)
- Monitoring stacks (Prometheus, Grafana)
- Message queues (RabbitMQ, Kafka)

[Learn more about Helm Resources →](/reference/resources/helm/)

### Custom Resources

[Custom resources](/reference/resources/custom/) run containerized HTTP services for installation and management. They provide:

- Language-agnostic implementation (any language with HTTP server support)
- Isolated execution environment via containers
- Standard REST API for lifecycle operations
- Full control over installation logic
- Support for hibernation and resume operations

**Use Cases:**
- Custom application installations requiring complex logic
- Advanced Kubernetes resource management
- Integration with external systems and APIs
- Custom deployment workflows
- Stateful application management

[Learn more about Custom Resources →](/reference/resources/custom/)

## Common Structure

All resource definitions share a common structure:

```yaml
kind: <Helm|Custom>
metadata:
  name: <resource-name>
  version: <semver>
  supportedOperatorVersion: <version-constraint>
  author: <optional>
  description: <optional>
  category: <optional>
  image: <optional>
  resource_usage:
    cpu: <optional>
    memory: <optional>
config:
  - type: <config-type>
    name: <config-name>
    alias: <config-alias>
    spec: <type-specific-spec>
spec:
  <kind-specific-spec>
```

## Metadata

Resource metadata provides information about the resource definition:

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Unique identifier for the resource | Yes |
| `version` | Semantic version of the resource definition | Yes |
| `supportedOperatorVersion` | Operator version constraint (e.g., ">= 0.0.0, < 1.0.0", "~1.2.0") | Yes |
| `author` | Resource maintainer or author | No |
| `description` | Human-readable description | No |
| `category` | Resource category for organization | No |
| `image` | Icon or logo URL | No |
| `resource_usage.cpu` | Expected CPU usage (e.g., "500m") | No |
| `resource_usage.memory` | Expected memory usage (e.g., "1Gi") | No |

**Version Constraints:**

The `supportedOperatorVersion` field uses semantic versioning constraints:

- `>=1.0.0`: Version 1.0.0 or higher
- `~1.2.0`: Version 1.2.x
- `^1.0.0`: Compatible with 1.x.x
- `>=1.0.0 <2.0.0`: Range constraint

## Configuration Schema

The `config` array defines user-configurable parameters with validation rules. Each configuration item has:

- **type**: The data type (string, integer, float, boolean, option, multiple-options)
- **name**: Internal field name
- **alias**: User-facing configuration key
- **spec**: Type-specific validation and default values

### Configuration Types

#### String

Text values with optional regex validation:

```yaml
- type: string
  name: databaseHost
  alias: dbHost
  spec:
    required: true
    default: "localhost"
    regex: "^[a-zA-Z0-9.-]+$"
    editable: true
```

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (string): Default value
- `regex` (string): Validation regex pattern
- `editable` (boolean): Whether users can modify this value

#### Integer

Numeric values with optional min/max constraints:

```yaml
- type: integer
  name: replicas
  alias: replicas
  spec:
    required: true
    default: 1
    min: 1
    max: 10
    editable: true
```

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (integer): Default value
- `min` (integer): Minimum allowed value
- `max` (integer): Maximum allowed value
- `editable` (boolean): Whether users can modify this value

#### Float

Floating-point values with optional min/max constraints:

```yaml
- type: float
  name: cpuLimit
  alias: cpu
  spec:
    required: false
    default: 1.0
    min: 0.1
    max: 8.0
    editable: true
```

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (float): Default value
- `min` (float): Minimum allowed value
- `max` (float): Maximum allowed value
- `editable` (boolean): Whether users can modify this value

#### Boolean

True/false values:

```yaml
- type: boolean
  name: enableMetrics
  alias: metrics
  spec:
    required: false
    default: false
    editable: true
```

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (boolean): Default value
- `editable` (boolean): Whether users can modify this value

#### Option (Single Selection)

Single selection from predefined values:

```yaml
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
```

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (string): Default value (must be in values list)
- `values` (array): List of allowed values
- `editable` (boolean): Whether users can modify this value

#### Multiple Options

Multiple selections from predefined values:

```yaml
- type: multiple-options
  name: features
  alias: features
  spec:
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

**Spec Fields:**
- `required` (boolean): Whether the field is required
- `default` (array): Default values (must be in values list)
- `values` (array): List of allowed values
- `min` (integer): Minimum number of selections
- `max` (integer): Maximum number of selections
- `editable` (boolean): Whether users can modify this value

## Using Resources in Modules

Resources are referenced in Module CRDs via the `source` field:

### HTTP URL Source

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgresql
spec:
  workspace:
    name: dev-workspace
  source:
    httpURL: https://example.com/resources/postgresql.yaml
  config:
    replicas: 2
    storageSize: "20Gi"
```

### Raw Embedded Source

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: custom-app
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
          file: /scripts/install.sh
  config:
    env: production
```

## Configuration Validation

The operator validates configuration values against the resource definition's config schema:

1. **Type Validation**: Ensures values match the expected type
2. **Required Fields**: Checks that all required fields are provided
3. **Constraints**: Validates min/max, regex, and allowed values
4. **Unknown Fields**: Rejects configuration fields not defined in the schema
5. **Defaults**: Applies default values for missing optional fields

## Best Practices

### Resource Definitions

1. **Versioning**: Use semantic versioning and specify operator compatibility
2. **Documentation**: Provide clear descriptions for metadata and config fields
3. **Defaults**: Set sensible defaults for all configuration options
4. **Validation**: Use appropriate constraints (min/max, regex) for safety
5. **Resource Estimation**: Document expected resource usage

### Configuration Design

1. **Simplicity**: Only expose necessary configuration options
2. **Naming**: Use clear, descriptive aliases for configuration fields
3. **Validation**: Provide helpful validation rules and error messages
4. **Grouping**: Group related configuration using naming conventions
5. **Editability**: Mark sensitive or system-managed fields as non-editable

### Organization

1. **Naming**: Use descriptive, unique names for resources
2. **Categories**: Use categories to organize related resources
3. **Repository**: Store resource definitions in version control
4. **Distribution**: Host resource definitions on accessible HTTP servers
5. **Testing**: Test resources in development environments before production use

## Examples

### Simple Helm Resource

```yaml
kind: Helm
metadata:
  name: nginx
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
config:
  - type: integer
    name: replicas
    alias: replicas
    spec:
      default: 1
      min: 1
      max: 5
spec:
  namespace: default
  repo: https://charts.bitnami.com/bitnami
  chartName: nginx
  version: 15.0.0
  values:
    - raw:
        replicaCount: "{{ .config.replicas }}"
```

### Simple Custom Resource

```yaml
kind: Custom
metadata:
  name: app-setup
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
config:
  - type: string
    name: namespace
    alias: namespace
    spec:
      default: "default"
spec:
  image: my-registry/app-setup:v1.0.0
```

## Related Resources

- [Helm Resources](/reference/resources/helm/) - Detailed Helm resource documentation
- [Custom Resources](/reference/resources/custom/) - Detailed Custom resource documentation
- [Module CRD](/reference/crds/module/) - Using resources in Modules
