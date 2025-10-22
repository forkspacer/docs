---
title: What is Forkspacer?
description: Introduction to Forkspacer and how it helps manage ephemeral Kubernetes environments
sidebar:
  order: 1
---

Forkspacer is an open-source Kubernetes operator that lets you create, fork, and hibernate entire development environments. It's designed for teams where each developer or feature branch needs an isolated, reproducible environment that can be managed declaratively.

## The Problem

Modern development teams face challenges managing multiple environments:

**Cost Explosion**: Running 10 developer environments 24/7 wastes resources during nights and weekends. Traditional solutions require manual intervention or complex scripts to scale down workloads.

**Environment Drift**: Manually created environments diverge from production. "It works on my machine" becomes "it works in my namespace" when each developer configures their environment differently.

**Slow Provisioning**: Creating a new testing environment requires copying Helm commands, updating values, managing secrets, and configuring services. This can take hours or days.

**Data Isolation Challenges**: Testing with production-like data requires either sharing a database (risking conflicts) or complex data migration scripts.

## The Solution

Forkspacer treats entire environments as declarative, forkable, hibernate-able resources.

### Declarative Environments

Define environments in YAML with GitOps-style reproducibility:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: feature-auth
spec:
  type: kubernetes
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5" # Sleep after work hours
```

### Environment Forking

Clone entire environments, including all applications and optionally their data:

```yaml
spec:
  from:
    name: staging
    namespace: staging
    migrateData: true # Copy persistent data too
```

This creates a complete copy with all databases, services, and configuration.

### Automatic Hibernation

Save costs by automatically scaling down idle environments:

- **Scheduled**: Cron-based wake/sleep cycles
- **Manual**: Instant hibernation on-demand
- **Per-module**: Hibernate expensive services independently

### Declarative Modules

Install applications with typed configuration and validation:

```yaml
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

  - name: "Replica Count"
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
        version: "14.0.0"
    namespace: default
    values:
      - raw:
          persistence:
            size: "{{.config.storageSize}}"
          replication:
            enabled: true
            slaveReplicas: "{{.config.replicas}}"
  workspace:
    name: feature-auth
  config:
    storageSize: "20Gi"
    replicas: 2
```

Modules directly contain their configuration schema and Helm chart specifications.

## Key Benefits

### Cost Optimization

- **Automatic hibernation** reduces compute costs by 70-80% for non-production environments
- **Scheduled wake/sleep** ensures environments only run during business hours
- **Selective hibernation** allows hibernating expensive components (databases, ML models) independently

### Developer Productivity

- **Instant environment creation** via `kubectl apply` instead of manual setup
- **Fork from production** to debug with real data in isolated environments
- **Self-service** without waiting for DevOps intervention
- **Consistent environments** eliminate "works on my machine" issues

### GitOps Integration

- **Declarative configuration** fits naturally into GitOps workflows
- **Version controlled environments** track changes over time
- **Reproducible deployments** from any point in history
- **PR-based workflows** for environment changes

### Flexibility

- **Helm chart support** for standard applications with inline configuration
- **Custom modules** for complex installation logic via containerized services
- **Multi-cluster** support for testing in different regions
- **Adopt existing Helm releases** to manage already-deployed applications
- **Typed configuration** with validation (string, integer, boolean, option, etc.)

## Use Cases

### Development Environments

**Problem**: 15 developers each need Redis, PostgreSQL, and a message queue. Running 24/7 wastes resources.

**Solution**: Each developer has a workspace that:

- Forks from a "baseline" template
- Auto-hibernates evenings and weekends (70% cost reduction)
- Can be recreated from scratch in minutes

```yaml
# developer-baseline workspace
# Each dev forks this and adds their custom services
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: dev-alice
spec:
  from:
    name: baseline
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5"
```

### Testing Environments

**Problem**: QA needs to test with production-like data but can't risk affecting real users.

**Solution**: Fork production workspace to staging with data migration:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: qa-testing-sprint-23
spec:
  from:
    name: production
    namespace: prod
    migrateData: true # Copy all PVCs, Secrets, ConfigMaps
```

Test freely in isolation, then delete when done.

### Preview Environments

**Problem**: Creating a preview environment for each PR is manual and tedious.

**Solution**: CI pipeline creates a workspace per PR, automatically hibernates when inactive, and deletes on merge:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: pr-1234
  labels:
    pr-number: "1234"
spec:
  from:
    name: staging
  autoHibernation:
    enabled: true
    schedule: "0 0 * * *" # Hibernate daily at midnight
```

### Staging Environments

**Problem**: Staging runs 24/7 but is only used during business hours.

**Solution**: Auto-hibernate staging on nights and weekends:

```yaml
spec:
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5" # Sleep 6 PM weekdays
    wakeSchedule: "0 8 * * 1-5" # Wake 8 AM weekdays
```

## How It's Different

### vs. Namespace-per-Developer

**Traditional approach**: Each developer gets a namespace and manually installs services.

**Problems**:

- No hibernation support
- No environment forking
- Manual installation is error-prone
- Resources waste money when idle

**Forkspacer**: Treats the entire namespace as a managed entity with lifecycle automation.

### vs. Ephemeral Environments (Okteto, DevSpace)

**Similar tools** focus on syncing local code to remote clusters for development.

**Forkspacer** focuses on managing complete, long-lived environments (dev, staging, testing) with:

- Hibernation for cost savings
- Environment forking for data isolation
- Multi-workspace orchestration
- Production-ready operator design

### vs. Manual Helm/Kubectl

**Traditional approach**: Run Helm commands manually or via scripts.

**Forkspacer**:

- Declarative workspace and module definitions
- Typed configuration with validation
- Built-in hibernation and forking
- Operator-managed reconciliation
- Configuration templating with Go templates

### vs. Terraform/Pulumi

**IaC tools** provision infrastructure but don't provide:

- Application-level hibernation
- Environment forking with data
- Kubernetes-native CRDs
- Real-time reconciliation

**Forkspacer** works alongside IaC tools, managing application-level environment lifecycle.

## Architecture

Forkspacer is a Kubernetes operator built with:

- **Custom Resource Definitions (CRDs)**: Workspace and Module resources
- **Controller Pattern**: Reconciles desired state continuously
- **Helm Integration**: Deploys charts with templated values directly from Module specs
- **Custom Module Support**: Extensibility via containerized HTTP services
- **Configuration Validation**: Typed schema validation before installation

Modules contain their configuration schema and installation specifications directly:

```
┌─────────────────────────────────────┐
│         Workspace (CRD)             │
│  An isolated Kubernetes environment │
└─────────────────────────────────────┘
              ↓ contains
┌─────────────────────────────────────┐
│          Module (CRD)               │
│  • Configuration schema             │
│  • Helm chart spec OR               │
│  • Custom module spec               │
│  • Validated config values          │
└─────────────────────────────────────┘
```

It runs entirely within Kubernetes and requires no external dependencies beyond cert-manager.

## When to Use Forkspacer

**Good fit** when you:

- Need multiple isolated environments (dev, staging, testing, preview)
- Want to reduce cloud costs for non-production workloads
- Need to fork environments with or without data
- Want GitOps-style declarative environment management
- Use Kubernetes and Helm

**Not a good fit** when you:

- Only need a single production environment
- Don't use Kubernetes
- Need sub-second environment creation (forking takes minutes)
- Require Windows container support

## Getting Started

Ready to try Forkspacer?

1. **[Understand Core Concepts →](/introduction/concepts/)** - Learn about Workspaces, Modules, and Hibernation
2. **[Install Forkspacer →](/guides/installation/)** - Deploy the operator to your cluster
3. **[Quick Start →](/guides/quick-start/)** - Create your first workspace in 5 minutes

## Community

- **GitHub**: [github.com/forkspacer/forkspacer](https://github.com/forkspacer/forkspacer)
- **Documentation**: You're reading it!
- **Issues**: [Report bugs or request features](https://github.com/forkspacer/forkspacer/issues)

Forkspacer is open-source under the Apache 2.0 license.
