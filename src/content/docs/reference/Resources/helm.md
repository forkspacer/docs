---
title: Helm
description: Helm resource definition reference for deploying Helm charts
sidebar:
    order: 2
---

# Helm Resources

Helm resources define how Helm charts should be deployed within a Module. They provide a declarative way to specify Helm repositories, chart versions, values, and configuration options.

## Structure

All Helm resources share this common structure:

```yaml
kind: Helm
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
  namespace: <target-namespace>
  repo: <helm-repo-url>
  chartName: <chart-name>
  version: <chart-version>
  values: <values-sources>
  outputs: <output-definitions>
  cleanup: <cleanup-config>
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

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `namespace` | string | Target Kubernetes namespace for the Helm release | Yes |
| `repo` | string | Helm chart repository URL | Yes |
| `chartName` | string | Name of the Helm chart in the repository | Yes |
| `version` | string | Chart version to install | Yes |
| `values` | array | Array of value sources (raw, file, configMap) | No |
| `outputs` | array | Output values to expose after installation | No |
| `cleanup` | object | Cleanup behavior when module is deleted | No |

### Values Sources

The `values` field accepts an array of value sources. Multiple sources can be specified and will be merged in order. Each source can be one of:

#### Raw Values

Inline YAML values with template support:

```yaml
values:
  - raw:
      replicaCount: "{{ .config.replicas }}"
      image:
        tag: "{{ .config.imageTag }}"
      resources:
        requests:
          cpu: "{{ .config.cpuRequest }}"
          memory: "{{ .config.memoryRequest }}"
```

#### File Values

HTTP/HTTPS URL to a values file:

```yaml
values:
  - file: https://example.com/helm-values/my-values.yaml
```

#### ConfigMap Values

Reference to a ConfigMap containing values:

```yaml
values:
  - configMap:
      name: helm-values
      namespace: default
```

**ConfigMap Data Key**: The values must be stored under the key `values` in the ConfigMap's data.

#### Combined Values Example

Multiple value sources can be specified and will be merged in order (later values override earlier ones):

```yaml
values:
  # Base values from HTTP URL
  - file: https://example.com/helm-values/base-values.yaml

  # Environment-specific overrides from ConfigMap
  - configMap:
      name: production-values
      namespace: default

  # Final templated overrides
  - raw:
      replicaCount: "{{ .config.replicas }}"
      image:
        tag: "{{ .config.imageTag }}"
```

### Outputs

Outputs allow you to expose values from the Helm release:

```yaml
outputs:
  - name: adminPassword
    valueFrom:
      secret:
        name: postgresql
        key: postgres-password
        namespace: default
  - name: endpoint
    value: "http://postgresql.default.svc.cluster.local:5432"
```

### Cleanup

Configure cleanup behavior when the module is deleted:

```yaml
cleanup:
  removeNamespace: false  # Whether to remove the namespace
  removePVCs: true        # Whether to remove PersistentVolumeClaims
```

## Templating

Helm resources support Go templating in **all spec fields**, not just `values`. Configuration values can be referenced using `{{ .config.<alias> }}` where `<alias>` matches the alias defined in the config array.

**Available template context:**

- `.config.<alias>`: User-provided configuration values
- `.releaseName`: Generated Helm release name

### Templating in Values

**Example:**

```yaml
config:
  - type: integer
    name: replicas
    alias: replicas
    spec:
      default: 1
  - type: string
    name: imageTag
    alias: tag
    spec:
      default: "latest"

spec:
  values:
    - raw:
        replicaCount: "{{ .config.replicas }}"
        image:
          tag: "{{ .config.tag }}"
```

### Templating in Other Spec Fields

All spec fields support templating, allowing dynamic configuration:

```yaml
config:
  - type: string
    name: targetNamespace
    alias: namespace
    spec:
      default: "default"
  - type: string
    name: chartVersion
    alias: version
    spec:
      default: "14.0.0"
  - type: string
    name: valuesURL
    alias: valuesUrl
    spec:
      default: "https://example.com/values/default.yaml"

spec:
  # Templated namespace
  namespace: "{{ .config.namespace }}"

  repo: https://charts.bitnami.com/bitnami
  chartName: postgresql

  # Templated version
  version: "{{ .config.version }}"

  values:
    # Templated file URL
    - file: "{{ .config.valuesUrl }}"

    # Templated raw values
    - raw:
        fullnameOverride: "{{ .releaseName }}-db"
```

### Advanced Templating

Templates support Go template functions and logic:

```yaml
spec:
  namespace: "{{ .config.namespace }}"

  values:
    - raw:
        # Conditional logic
        enabled: {{ if eq .config.environment "production" }}true{{ else }}false{{ end }}

        # String manipulation
        serviceName: "{{ .releaseName | lower }}-svc"

        # Default values
        storageClass: {{ default "standard" .config.storageClass }}

        # Numeric operations
        maxConnections: {{ mul .config.replicas 10 }}
```

## Complete Example

Here's a complete Helm resource for PostgreSQL:

```yaml
kind: Helm
metadata:
  name: postgresql
  version: 1.0.0
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
  author: "Platform Team"
  description: "PostgreSQL database with customizable configuration"
  category: "Database"
  resource_usage:
    cpu: "500m"
    memory: "1Gi"

config:
  - type: integer
    name: replicas
    alias: replicas
    spec:
      required: true
      default: 1
      min: 1
      max: 5
      editable: true

  - type: string
    name: storageClass
    alias: storageClass
    spec:
      required: false
      default: "standard"
      editable: true

  - type: string
    name: storageSize
    alias: storageSize
    spec:
      required: false
      default: "10Gi"
      regex: "^[0-9]+(Mi|Gi|Ti)$"
      editable: true

  - type: boolean
    name: enableBackups
    alias: backups
    spec:
      required: false
      default: false
      editable: true

  - type: string
    name: targetNamespace
    alias: namespace
    spec:
      required: false
      default: "default"
      editable: true

  - type: string
    name: chartVersion
    alias: chartVersion
    spec:
      required: false
      default: "14.0.0"
      editable: true

spec:
  # Templated namespace from config
  namespace: "{{ .config.namespace }}"

  repo: https://charts.bitnami.com/bitnami
  chartName: postgresql

  # Templated chart version from config
  version: "{{ .config.chartVersion }}"

  values:
    - raw:
        architecture: replication
        replicaCount: "{{ .config.replicas }}"
        persistence:
          enabled: true
          storageClass: "{{ .config.storageClass }}"
          size: "{{ .config.storageSize }}"
        backup:
          enabled: "{{ .config.backups }}"

  outputs:
    - name: password
      valueFrom:
        secret:
          name: "{{ .releaseName }}-postgresql"
          key: postgres-password
          namespace: default

    - name: connectionString
      value: "postgresql://postgres@{{ .releaseName }}-postgresql:5432/postgres"

  cleanup:
    removeNamespace: false
    removePVCs: true
```

## Usage in Modules

To use a Helm resource in a Module:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-database
spec:
  workspace:
    name: dev-workspace
  source:
    httpURL: https://example.com/resources/postgresql.yaml
  config:
    replicas: 2
    storageSize: "20Gi"
    backups: true
```

Or embed it directly:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: my-database
spec:
  workspace:
    name: dev-workspace
  source:
    raw:
      kind: Helm
      metadata:
        name: postgresql
        version: 1.0.0
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        namespace: default
        repo: https://charts.bitnami.com/bitnami
        chartName: postgresql
        version: 14.0.0
        values:
          - raw:
              replicaCount: 2
```

## Values File Distribution

When using the `file` option for Helm values, the files must be hosted on accessible HTTP/HTTPS URLs.

### Hosting Options

**Static File Server:**
```bash
# Serve values files via HTTP
cd helm-values
python3 -m http.server 8080

# Access at: http://localhost:8080/my-values.yaml
```

**Object Storage:**
- Amazon S3
- Google Cloud Storage
- Azure Blob Storage
- MinIO

**Web Server:**
- Nginx
- Apache
- GitHub Releases/Raw

### Example Distribution

**Hosting on GitHub Raw:**
```yaml
values:
  - file: https://raw.githubusercontent.com/org/repo/main/helm-values/production.yaml
```

**Hosting on Object Storage:**
```yaml
values:
  - file: https://storage.googleapis.com/my-bucket/helm-values/production.yaml
```

**Hosting on CDN:**
```yaml
values:
  - file: https://cdn.example.com/helm-values/v1.0.0/production.yaml
```

### ConfigMap for Private Values

For sensitive or environment-specific values, use ConfigMaps:

```bash
# Create ConfigMap from values file
kubectl create configmap production-values \
  --from-file=values=production-values.yaml \
  --namespace=default
```

## Best Practices

1. **Version Constraints**: Use semantic versioning constraints in `supportedOperatorVersion` to ensure compatibility
2. **Resource Usage**: Document expected resource usage to help users plan capacity
3. **Configuration Defaults**: Provide sensible defaults for all configuration options
4. **Validation**: Use appropriate validation rules (min/max, regex) for configuration items
5. **Templating**: Use templates in all spec fields (namespace, version, values, file URLs) for dynamic configuration
6. **Cleanup**: Configure appropriate cleanup behavior based on resource persistence requirements
7. **Documentation**: Include clear descriptions in metadata and configuration items
8. **Values Distribution**: Host values files on reliable, versioned URLs for production use
9. **Values Layering**: Use multiple value sources to separate base configuration from environment-specific overrides
10. **Secrets Management**: Store sensitive values in ConfigMaps or Kubernetes Secrets, not in HTTP-accessible files
11. **Template Functions**: Leverage Go template functions (default, if/else, string manipulation) for advanced logic
12. **Namespace Control**: Use templated namespace field to allow users to control deployment location

## Related Resources

- [Custom Resources](./custom.md) - Custom plugin-based resources
- [Overview](./overview.md) - Resource definitions overview
- [Module CRD](/reference/crds/module/) - Using resources in Modules
