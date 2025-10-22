---
title: Core Concepts
description: Understanding Forkspacer's key concepts and architecture
sidebar:
  order: 2
---

This page explains the fundamental concepts you need to understand how Forkspacer works.

## The Forkspacer Model

Forkspacer uses a two-layer architecture to manage environments:

```
┌─────────────────────────────────────┐
│         Workspace (CRD)             │
│  An isolated Kubernetes environment │
│  • Can hibernate to save costs      │
│  • Can be forked from others        │
│  • Scheduled auto-hibernation       │
└─────────────────────────────────────┘
              ↓ contains
┌─────────────────────────────────────┐
│          Module (CRD)               │
│  Declares what to install & how     │
│  • References a workspace           │
│  • Contains Helm or Custom config   │
│  • Validates configuration          │
│  • Helm: Deploy charts directly     │
│  • Custom: Run install containers   │
└─────────────────────────────────────┘
```

**Think of it like this:**

- **Workspace** = A separate development environment (like a VM or namespace, but smarter)
- **Module** = A complete declaration of what to install and how to configure it

## Workspace

A **Workspace** represents an isolated Kubernetes environment that Forkspacer can manage. It's a Kubernetes Custom Resource (CRD) that describes an environment.

### Key Capabilities

**Hibernation**: Scale down all workloads to save resources and costs

```yaml
spec:
  hibernated: true
```

**Auto-hibernation**: Schedule automatic sleep/wake cycles

```yaml
spec:
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5" # Sleep at 6 PM weekdays
    wakeSchedule: "0 8 * * 1-5" # Wake at 8 AM weekdays
```

**Forking**: Clone an entire workspace including all its modules

```yaml
spec:
  from:
    name: production-workspace
    namespace: prod
    migrateData: true # Optional: copy persistent data
```

### Connection Types

Workspaces can target different Kubernetes clusters:

- **`in-cluster`**: The same cluster where Forkspacer runs
- **`local`**: Uses your local kubeconfig (development mode)
- **`kubeconfig`**: Uses a kubeconfig stored in a Secret (remote clusters)

### Use Cases

- **Development environments** that automatically hibernate after hours
- **Testing environments** forked from staging with real data
- **Preview environments** for feature branches that clean up automatically
- **Cost optimization** for non-production workloads

## Module

A **Module** is a Kubernetes CRD that declares **what** application to install into a workspace and **how** to configure it. Modules directly contain either Helm chart configuration or custom module configuration.

### Anatomy of a Module

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis # Name of this module instance

config: # Configuration schema with validation
  - name: "Replica Count"
    alias: "replicaCount"
    integer:
      default: 1
      min: 0
      max: 5

spec:
  helm: # Helm chart configuration
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "21.2.9"
    namespace: default
    values:
      - raw:
          replica:
            replicaCount: "{{.config.replicaCount}}"

  workspace: # Where to install
    name: dev-environment

  config: # Configuration values
    replicaCount: 2
```

### What Modules Do

1. **Define configuration schema**: Specify typed configuration options with validation
2. **Reference a workspace**: Specifies which environment to target
3. **Contain installation logic**: Either Helm chart config or custom module config
4. **Validate configuration**: Ensure config values meet requirements before installation
5. **Track status**: Report installation state (installing, ready, failed, etc.)

### Module Types

Modules can be one of two types:

**Helm Modules** - Deploy Helm charts:

```yaml
spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
        version: "21.2.9"
    namespace: default
```

**Custom Modules** - Run containerized installation logic:

```yaml
spec:
  custom:
    image: my-registry/installer:v1.0.0
    permissions:
      - workspace
```

**Adopting Existing Helm Releases**:

```yaml
spec:
  helm:
    chart:
      repo:
        url: https://charts.bitnami.com/bitnami
        chart: redis
    existingRelease:
      name: existing-redis
      namespace: default
```

## Configuration

Modules have a powerful configuration system with typed validation. Configuration is defined directly in the Module CRD.

### Configuration Schema

The top-level `config` array defines what configuration options are available:

```yaml
config:
  - name: "Environment" # Display name
    alias: "environment" # Key used in spec.config
    option: # Single selection dropdown
      values: [dev, staging, prod]
      default: "dev"
      required: true

  - name: "Replicas"
    alias: "replicas"
    integer: # Number with validation
      min: 1
      max: 10
      default: 3

  - name: "Domain"
    alias: "domain"
    string: # Text with regex validation
      regex: "^[a-z0-9.-]+$"
      required: true
```

### Configuration Types

- **string**: Text with optional regex validation
- **integer**: Numbers with min/max constraints
- **float**: Decimal numbers with min/max constraints
- **boolean**: True/false values
- **option**: Single selection from a list of values
- **multipleOptions**: Multiple selections from a list

### Using Configuration

Users provide values in `spec.config`:

```yaml
spec:
  config:
    environment: staging
    replicas: 5
    domain: "staging.example.com"
```

The operator validates these values against the schema before installation.

### Templating

Configuration values can be used in Helm values via Go templates:

```yaml
spec:
  helm:
    values:
      - raw:
          replicaCount: "{{.config.replicas}}"
          domain: "{{.config.domain}}"
```

## Hibernation

**Hibernation** is Forkspacer's cost-saving feature that scales down resources while preserving state.

### How It Works

When a Workspace hibernates:

1. All Modules in the workspace are instructed to hibernate
2. For Helm modules: Deployments/StatefulSets scale to 0 replicas
3. For Custom modules: The container receives a hibernate HTTP request
4. State is preserved (ConfigMaps, Secrets, PVCs remain)

When a Workspace wakes:

1. Resources scale back to original replica counts
2. Applications resume normal operation

### Manual Hibernation

```yaml
# Hibernate immediately
kubectl patch workspace dev -p '{"spec":{"hibernated":true}}' --type=merge

# Wake up
kubectl patch workspace dev -p '{"spec":{"hibernated":false}}' --type=merge
```

### Automatic Hibernation

Schedule hibernation with cron expressions:

```yaml
spec:
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5" # 6 PM weekdays
    wakeSchedule: "0 8 * * 1-5" # 8 AM weekdays
```

**Cron format**: `minute hour day month weekday` (5 fields) or `second minute hour day month weekday` (6 fields)

### Module-Level Hibernation

Individual modules can hibernate independently:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: expensive-service
spec:
  hibernated: true # Only this module hibernates
```

## Forking

**Forking** creates a complete copy of a workspace, including all its modules.

### Basic Forking

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: testing-env
spec:
  from:
    name: staging-env
    namespace: staging
```

This creates:

- A new workspace named `testing-env`
- Copies of all Modules from `staging-env`
- Fresh installations with the same configuration

### Forking with Data Migration

```yaml
spec:
  from:
    name: production
    namespace: prod
    migrateData: true
```

With `migrateData: true`, Forkspacer also copies:

- Persistent Volume Claims (PVCs)
- Secrets
- ConfigMaps

**Important**: Data migration:

- Temporarily hibernates source and destination during transfer
- Requires module definitions to specify migration configuration
- Is not guaranteed (depends on storage compatibility)
- Preserves the source workspace unchanged

### Use Cases

- **Testing with production data**: Fork prod to staging with real data
- **Feature development**: Each developer forks from a baseline
- **Debugging**: Fork production to investigate issues without affecting users
- **Training environments**: Create disposable environments from templates

## Putting It Together

Here's a complete example showing how these concepts work together:

```yaml
# 1. Create a workspace that hibernates after hours
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: dev-environment
  namespace: default
spec:
  type: kubernetes
  connection:
    type: in-cluster
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5"
    wakeSchedule: "0 8 * * 1-5"

---
# 2. Deploy Redis module into the workspace
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis
  namespace: default

config:
  - name: "Replica Count"
    alias: "replicaCount"
    integer:
      default: 1
      min: 0
      max: 5

  - name: "Redis Version"
    alias: "version"
    option:
      default: "21.2.9"
      values: ["21.2.9", "21.2.7"]

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

  workspace:
    name: dev-environment

  config:
    replicaCount: 2
    version: "21.2.9"

---
# 3. Deploy PostgreSQL module into the same workspace
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: postgres
  namespace: default

config:
  - name: "Storage Size"
    alias: "storageSize"
    string:
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
    storageSize: "10Gi"
```

**What happens**:

1. Forkspacer creates the `dev-environment` workspace
2. Validates Redis configuration against the schema
3. Installs Redis Helm chart with configured values
4. Validates PostgreSQL configuration against the schema
5. Installs PostgreSQL Helm chart
6. At 6 PM on weekdays, automatically hibernates both Redis and PostgreSQL
7. At 8 AM on weekdays, automatically wakes them back up

## Next Steps

Now that you understand the core concepts:

- **[Install Forkspacer →](/guides/installation/)** - Set up the operator in your cluster
- **[Quick Start →](/guides/quick-start/)** - Create your first workspace and module
- **[CRD Reference →](/reference/crds/overview/)** - Detailed API documentation
- **[Module Definitions →](/reference/resources/overview/)** - Learn to create reusable module definitions
