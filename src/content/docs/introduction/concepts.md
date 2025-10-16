---
title: Core Concepts
description: Understanding Forkspacer's key concepts and architecture
sidebar:
  order: 2
---

This page explains the fundamental concepts you need to understand how Forkspacer works.

## The Forkspacer Model

Forkspacer uses a three-layer architecture to manage environments:

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
│  Declares WHAT to install           │
│  • References a workspace           │
│  • References a module definition   │
│  • Provides configuration values    │
└─────────────────────────────────────┘
              ↓ references
┌─────────────────────────────────────┐
│      Module Definition              │
│  A reusable template describing     │
│  HOW to install an application      │
│  • Helm: Deploy Helm charts         │
│  • Custom: Run install containers   │
└─────────────────────────────────────┘
```

**Think of it like this:**

- **Workspace** = A separate development environment (like a VM or namespace, but smarter)
- **Module** = A declaration "Install Redis in my-workspace with these settings"
- **Module Definition** = The actual instructions for installing Redis

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

A **Module** is a Kubernetes CRD that declares **what** application to install into a workspace and **how** to configure it.

### Anatomy of a Module

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis # Name of this module instance
spec:
  workspace: # Where to install
    name: dev-environment
  source: # Where to get installation instructions
    httpURL: https://example.com/modules/redis.yaml
  config: # Configuration values
    replicaCount: 2
    version: "21.2.9"
```

### What Modules Do

1. **Reference a workspace**: Specifies which environment to target
2. **Reference a module definition**: Points to installation instructions (via URL, ConfigMap, or raw YAML)
3. **Provide configuration**: Pass values that customize the installation
4. **Track status**: Report installation state (installing, ready, failed, etc.)

### Module Sources

Modules can load their definitions from multiple sources:

**HTTP URL** (most common):

```yaml
source:
  httpURL: https://raw.githubusercontent.com/forkspacer/modules/main/redis/module.yaml
```

**Raw embedded**:

```yaml
source:
  raw:
    kind: Helm
    metadata:
      name: redis
    spec:
      repo: https://charts.bitnami.com/bitnami
      chartName: redis
```

**ConfigMap**:

```yaml
source:
  configMap:
    name: redis-module-definition
```

**Existing Helm release** (adopt already-installed apps):

```yaml
source:
  existingHelmRelease:
    name: existing-redis
    namespace: default
```

## Module Definition

A **Module Definition** is a reusable template that describes **how** to install an application. Think of it as a recipe that Modules follow.

Module Definitions are **not** Kubernetes resources. They are YAML files that define installation logic.

### Two Types

#### Helm Module Definitions

Deploy Helm charts with configurable values:

```yaml
kind: Helm
metadata:
  name: redis
  version: "1.0.0"
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"

config:
  - type: integer
    name: "Replica Count"
    alias: replicaCount
    spec:
      default: 1
      min: 0
      max: 5

spec:
  namespace: default
  repo: https://charts.bitnami.com/bitnami
  chartName: redis
  version: "21.2.9"
  values:
    - raw:
        replica:
          replicaCount: "{{.config.replicaCount}}"
```

#### Custom Module Definitions

Run containerized installation logic (any language):

```yaml
kind: Custom
metadata:
  name: complex-installer
  version: "1.0.0"
  supportedOperatorVersion: ">= 0.0.0, < 1.0.0"

spec:
  image: "my-registry/installer:v1.0.0"
```

The container receives HTTP requests to install, uninstall, hibernate, and resume applications.

### Configuration Schema

Module Definitions declare what configuration options they accept:

```yaml
config:
  - type: option # Dropdown selection
    name: "Environment"
    alias: environment
    spec:
      values: [dev, staging, prod]
      default: "dev"

  - type: integer # Number with validation
    name: "Replicas"
    alias: replicas
    spec:
      min: 1
      max: 10
      default: 3

  - type: string # Text with regex validation
    name: "Domain"
    alias: domain
    spec:
      regex: "^[a-z0-9.-]+$"
```

Users provide values when creating Modules:

```yaml
# Module references the definition and provides config
spec:
  source:
    httpURL: https://example.com/modules/myapp.yaml
  config:
    environment: staging
    replicas: 5
    domain: "staging.example.com"
```

The operator validates config against the schema before installation.

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
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://raw.githubusercontent.com/forkspacer/modules/main/redis/1.0.0/module.yaml
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
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://raw.githubusercontent.com/forkspacer/modules/main/postgresql/1.0.0/module.yaml
  config:
    storageSize: "10Gi"
    enableBackups: false
```

**What happens**:

1. Forkspacer creates the `dev-environment` workspace
2. Fetches the Redis module definition from GitHub
3. Installs Redis using the Helm chart specified in the definition
4. Fetches the PostgreSQL module definition
5. Installs PostgreSQL
6. At 6 PM on weekdays, automatically hibernates both Redis and PostgreSQL
7. At 8 AM on weekdays, automatically wakes them back up

## Next Steps

Now that you understand the core concepts:

- **[Install Forkspacer →](/guides/installation/)** - Set up the operator in your cluster
- **[Quick Start →](/guides/quick-start/)** - Create your first workspace and module
- **[CRD Reference →](/reference/crds/overview/)** - Detailed API documentation
- **[Module Definitions →](/reference/resources/overview/)** - Learn to create reusable module definitions
