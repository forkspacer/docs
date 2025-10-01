---
title: Workspace
description: Workspace Custom Resource Definition reference
sidebar:
    order: 2
---

# Workspace

The `Workspace` resource represents a Kubernetes environment that can be managed, hibernated, and forked by the forkspacer operator. It provides capabilities for environment lifecycle management, including automatic hibernation scheduling and connection configuration.

## API Group and Version

- **API Group:** `batch.forkspacer.com`
- **API Version:** `v1`
- **Kind:** `Workspace`
- **Short Name:** `ws`

## Example

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: dev-environment
  namespace: default
spec:
  type: kubernetes
  hibernated: false
  connection:
    type: local
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5"  # Hibernate at 6 PM on weekdays
    wakeSchedule: "0 8 * * 1-5"  # Wake at 8 AM on weekdays
status:
  phase: ready
  ready: true
  lastActivity: "2025-10-01T10:30:00Z"
  conditions:
    - type: Available
      status: "True"
      lastTransitionTime: "2025-10-01T10:30:00Z"
      reason: WorkspaceReady
      message: Workspace is fully operational
```

## Spec Fields

The `.spec` field defines the desired state of the Workspace.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `type` | string | Type of workspace. Currently only supports `kubernetes`. | No (default: `kubernetes`) |
| `from` | object | Reference to another workspace to fork from. See [FromReference](#fromreference). | No |
| `hibernated` | boolean | Whether the workspace should be in hibernated state. | No (default: `false`) |
| `connection` | object | Configuration for connecting to the workspace. See [Connection](#connection). | No |
| `autoHibernation` | object | Configuration for automatic hibernation scheduling. See [AutoHibernation](#autohibernation). | No |

### FromReference

The `from` field allows you to create a workspace by forking from an existing workspace.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the source workspace to fork from. | Yes |
| `namespace` | string | Namespace of the source workspace. | Yes (default: `default`) |

**Example:**

```yaml
spec:
  from:
    name: production-workspace
    namespace: prod
```

### Connection

The `connection` field configures how the operator connects to the workspace.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `type` | string | Connection type. Options: `local`, `in-cluster`, `kubeconfig`. | Yes (default: `local`) |
| `secretReference` | object | Reference to a secret containing connection credentials. See [SecretReference](#secretreference). | No |

**Example:**

```yaml
spec:
  connection:
    type: kubeconfig
    secretReference:
      name: workspace-kubeconfig
      namespace: default
```

### SecretReference

The `secretReference` field within `connection` specifies a Kubernetes Secret containing connection credentials.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Name of the secret. | Yes |
| `namespace` | string | Namespace of the secret. | No (default: `default`) |

### AutoHibernation

The `autoHibernation` field enables automatic hibernation and wake scheduling based on cron expressions.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `enabled` | boolean | Whether auto-hibernation is enabled. | No (default: `false`) |
| `schedule` | string | Cron expression for hibernation schedule. Supports standard 5-field format or 6-field format with optional seconds. | Yes (when enabled) |
| `wakeSchedule` | string | Cron expression for wake schedule. Supports standard 5-field format or 6-field format with optional seconds. | No |

**Cron Format:**

The cron expressions support two formats:
- **5-field format**: `minute hour day month weekday` (e.g., `0 22 * * *`)
- **6-field format**: `second minute hour day month weekday` (e.g., `0 0 22 * * *`)

**Example:**

```yaml
spec:
  autoHibernation:
    enabled: true
    schedule: "0 22 * * *"        # 5-field: Hibernate at 10 PM daily
    wakeSchedule: "0 0 6 * * *"   # 6-field: Wake at 6 AM daily (with seconds)
```

## Status Fields

The `.status` field reflects the observed state of the Workspace.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `phase` | string | Current phase of the workspace. Values: `ready`, `hibernated`, `failed`, `terminating`. | Yes |
| `ready` | boolean | Indicates if the workspace is fully operational. | No (default: `false`) |
| `lastActivity` | string (date-time) | Timestamp of the last activity in the workspace. | No |
| `hibernatedAt` | string (date-time) | Timestamp when the workspace was hibernated. | No |
| `message` | string | Human-readable message about the current state. | No |
| `conditions` | array | Standard Kubernetes conditions. See [Conditions](#conditions). | No |

### Conditions

Standard Kubernetes condition types used to represent the workspace state:

- **Available**: The workspace is fully functional and ready for use.
- **Progressing**: The workspace is being created, updated, or transitioning between states.
- **Degraded**: The workspace failed to reach or maintain its desired state.

Each condition has the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Condition type (e.g., "Available", "Progressing", "Degraded"). |
| `status` | string | Condition status: `True`, `False`, or `Unknown`. |
| `lastTransitionTime` | string (date-time) | Last time the condition transitioned. |
| `reason` | string | Programmatic identifier for the condition's last transition. |
| `message` | string | Human-readable message explaining the condition. |
| `observedGeneration` | integer | The `.metadata.generation` that the condition was set based upon. |

## Phase Values

The `status.phase` field can have the following values:

- **`ready`**: Workspace is operational and available for use.
- **`hibernated`**: Workspace is in hibernated state with resources scaled down.
- **`failed`**: Workspace encountered an error and is not operational.
- **`terminating`**: Workspace is being deleted.

## Usage Examples

### Creating a Simple Workspace

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: my-workspace
spec:
  type: kubernetes
```

### Creating a Workspace with Auto-Hibernation

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: cost-optimized-workspace
spec:
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5"  # Hibernate on weekday evenings
    wakeSchedule: "0 8 * * 1-5"  # Wake on weekday mornings
```

### Forking from Another Workspace

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: testing-workspace
spec:
  from:
    name: production-workspace
    namespace: prod
```

### Hibernating a Workspace Manually

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: my-workspace
spec:
  hibernated: true
```

## Related Resources

- [Module](./module.md) - Modules are deployed into Workspaces
- [Overview](./overview.md) - CRD overview and architecture
