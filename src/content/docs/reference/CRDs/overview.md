---
title: Overview
description: Overview of Custom Resource Definitions in forkspacer.com Operator
sidebar:
    order: 1
---

# Custom Resource Definitions (CRDs)

The forkspacer operator extends Kubernetes with two primary Custom Resource Definitions (CRDs) that enable declarative management of ephemeral development and testing environments.

## API Group

All CRDs belong to the `batch.forkspacer.com` API group, version `v1`.

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

A `Module` represents an installable application or component that is deployed into a `Workspace`. Modules can deploy Helm charts or run custom containerized modules, with built-in configuration validation.

**Key Features:**
- Helm chart deployment with multiple sources (repository, git, configMap)
- Custom containerized modules with HTTP API interface
- Declarative configuration schema with typed validation
- Configuration templating with Go templates
- Independent hibernation control
- Adoption of existing Helm releases
- Installation lifecycle tracking

**Use Cases:**
- Deploying Helm charts from repositories or git
- Running custom installation logic via containerized modules
- Installing applications with validated configuration
- Adopting and tracking existing Helm releases
- Managing add-ons and platform components

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
│  • Helm charts or custom modules            │
│  • Typed configuration with validation       │
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
apiVersion: batch.forkspacer.com/v1
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
# 2. Deploy a Redis module with Helm
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: redis
  namespace: default

config:
  - name: "Redis Version"
    alias: "version"
    option:
      default: "21.2.9"
      values:
        - "21.2.9"
        - "21.2.7"

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
          image:
            repository: bitnamilegacy/redis
          global:
            security:
              allowInsecureImages: true
  workspace:
    name: dev-environment
  config:
    version: "21.2.9"

---
# 3. Deploy a custom monitoring module
apiVersion: batch.forkspacer.com/v1
kind: Module
metadata:
  name: monitoring
  namespace: default
spec:
  custom:
    image: my-registry/monitoring:v1.0.0
    permissions:
      - workspace
  workspace:
    name: dev-environment
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

- [Workspace Reference](/reference/crds/workspace/) - Complete Workspace CRD specification
- [Module Reference](/reference/crds/module/) - Complete Module CRD specification

## API Reference

For the complete OpenAPI schema, refer to the generated CRD YAML files:
- `config/crd/bases/batch.forkspacer.com_workspaces.yaml`
- `config/crd/bases/batch.forkspacer.com_modules.yaml`
