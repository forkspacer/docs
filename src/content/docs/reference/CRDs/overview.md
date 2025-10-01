---
title: Overview
description: Overview of Custom Resource Definitions in Environment.sh Operator
sidebar:
    order: 1
---

# Custom Resource Definitions (CRDs)

The forkspacer operator extends Kubernetes with two primary Custom Resource Definitions (CRDs) that enable declarative management of ephemeral development and testing environments.

## API Group

All CRDs belong to the `batch.environment.sh` API group, version `v1`.

## Core Resources

### Workspace

A `Workspace` represents a managed Kubernetes environment that can be created, hibernated, forked, and destroyed. Workspaces provide the foundation for cost-effective, on-demand environments.

**Key Features:**
- Environment lifecycle management (creation, hibernation, deletion)
- Automatic hibernation scheduling with cron expressions
- Environment forking from existing workspaces
- Multiple connection types (local, in-cluster, kubeconfig)
- Resource state tracking with standard Kubernetes conditions

**Use Cases:**
- Development environments that automatically hibernate after hours
- Testing environments that can be quickly forked from production
- Staging environments with scheduled activation periods
- Cost-optimized preview environments

[Learn more about Workspace →](/reference/crds/workspace/)

### Module

A `Module` represents an installable application or component that is deployed into a `Workspace`. Modules support multiple source types and can be individually hibernated.

**Key Features:**
- Multiple source types: raw manifests, HTTP URLs
- Custom configuration via arbitrary key-value pairs
- Independent hibernation control
- Installation lifecycle tracking
- Phase-based status reporting

**Use Cases:**
- Installing applications from external manifest repositories
- Deploying microservices into workspaces
- Managing add-ons and platform components
- Coordinating multi-component deployments

[Learn more about Module →](/reference/crds/module/)

## Architecture Overview

### Resource Relationship

```
┌──────────────────────────────────────────────┐
│                  Workspace                   │
│  (Managed Kubernetes Environment)            │
│                                              │
│  • Lifecycle: ready, hibernated, failed      │
│  • Auto-hibernation scheduling               │
│  • Environment forking                       │
└──────────────────────────────────────────────┘
             ▲
             │
             │ references
             │
┌────────────┴─────────────────────────────────┐
│                   Module                     │
│  (Installable Application/Component)         │
│                                              │
│  • Sources: raw, httpURL                     │
│  • Custom configuration                      │
│  • Lifecycle: ready, installing, hibernated  │
└──────────────────────────────────────────────┘
```

### Typical Workflow

1. **Create a Workspace**: Define and create a Workspace resource to establish a managed environment.

2. **Deploy Modules**: Create Module resources that reference the Workspace and specify application sources.

3. **Configure Auto-Hibernation**: Optionally configure automatic hibernation schedules to reduce costs.

4. **Fork Environments**: Create new Workspaces from existing ones for testing or development purposes.

5. **Manage Lifecycle**: The operator continuously reconciles the desired state, handling hibernation, wake-ups, and installations.

## Example: Complete Environment Setup

```yaml
# 1. Create a development workspace
apiVersion: batch.environment.sh/v1
kind: Workspace
metadata:
  name: dev-environment
  namespace: default
spec:
  type: kubernetes
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5"  # Hibernate weekday evenings
    wakeSchedule: "0 8 * * 1-5"  # Wake weekday mornings

---
# 2. Deploy an API service module
apiVersion: batch.environment.sh/v1
kind: Module
metadata:
  name: api-service
  namespace: default
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://example.com/manifests/api.yaml
  config:
    replicas: 2
    environment: development

---
# 3. Deploy a monitoring module
apiVersion: batch.environment.sh/v1
kind: Module
metadata:
  name: monitoring
  namespace: default
spec:
  workspace:
    name: dev-environment
  source:
    httpURL: https://example.com/manifests/prometheus.yaml
```

## Hibernation and Cost Optimization

Both Workspaces and Modules support hibernation, a key feature for cost optimization:

- **Workspace Hibernation**: When a Workspace is hibernated, its resources are scaled down or suspended, reducing compute costs while preserving state.

- **Module Hibernation**: Individual Modules can be hibernated independently, allowing fine-grained control over resource usage.

- **Auto-Hibernation**: Workspaces support cron-based scheduling for automatic hibernation and wake-up, ideal for development environments used only during business hours.

## Status Reporting

Both resources use standard Kubernetes status conventions:

- **Phase**: High-level state indicator (e.g., `ready`, `hibernated`, `failed`)
- **Conditions**: Detailed condition types (`Available`, `Progressing`, `Degraded`)
- **Timestamps**: Activity tracking with `lastActivity` and `hibernatedAt` fields
- **Messages**: Human-readable status messages

## Further Reading

- [Workspace Reference](./workspace.md) - Complete Workspace CRD specification
- [Module Reference](./module.md) - Complete Module CRD specification

## API Reference

For the complete OpenAPI schema, refer to the generated CRD YAML files:
- `config/crd/bases/batch.environment.sh_workspaces.yaml`
- `config/crd/bases/batch.environment.sh_modules.yaml`
