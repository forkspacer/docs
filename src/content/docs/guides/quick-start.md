---
title: Quick Start
description: Get started with Forkspacer in 5 minutes
sidebar:
  order: 2
---

This guide will help you create your first workspace and deploy a module in just a few minutes.

## Prerequisites

- Forkspacer operator installed ([Installation Guide](/guides/installation/))
- `kubectl` configured to access your cluster

## Step 1: Create Your First Workspace

Create a file named `workspace.yaml`:

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: default
  namespace: default
spec:
  type: kubernetes
  connection:
    type: in-cluster
```

Apply the workspace:

```bash
kubectl apply -f workspace.yaml
```

Check the workspace status:

```bash
kubectl get workspaces
```

Output:

```
NAME      PHASE   AGE
default   ready   30s
```

## Step 2: Deploy a Module

Create a Redis module. Save this as `module_helm.yaml`:

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
    name: default
    namespace: default

  hibernated: false

  config:
    version: "21.2.7"
    replicaCount: 1
```

Deploy the module:

```bash
kubectl apply -f module_helm.yaml
```

Check the module status:

```bash
kubectl get modules
```

Output:

```
NAME    WORKSPACE   PHASE   AGE
redis   default     ready   45s
```

## Understanding What You Created

Before we continue, let's understand what just happened:

You now have three components working together:

1. **Workspace** (`default`): An isolated Kubernetes environment managed by Forkspacer
2. **Module** (`redis`): A Kubernetes CRD that declares "install Redis in the default workspace"
3. **Module Definition**: A YAML template hosted on GitHub that describes how to install Redis using a Helm chart

When you created the Module, the Forkspacer operator:

1. Detected the new Module CRD
2. Fetched the module definition from the GitHub URL
3. Parsed the Helm configuration in that definition
4. Installed Redis using the Helm chart specified in the definition
5. Applied your configuration values (`replicaCount`, `version`)

> **What's in that URL?** The GitHub URL points to a [module definition](/introduction/concepts/#module-definition) - a reusable template that describes how to install Redis. Module definitions can be shared across teams and stored in Git repositories. [View the Redis module definition →](https://raw.githubusercontent.com/forkspacer/modules/refs/heads/main/redis/1.0.0/module.yaml)

## Step 3: Verify the Deployment

Check the pods created by the module:

```bash
kubectl get pods -l app.kubernetes.io/name=redis
```

You should see Redis pods running:

```
NAME                 READY   STATUS    RESTARTS   AGE
redis-master-0       1/1     Running   0          1m
redis-replicas-0     1/1     Running   0          1m
```

## Step 4: Test Hibernation

Manually hibernate the workspace:

```bash
kubectl patch workspace default -p '{"spec":{"hibernated":true}}' --type=merge
```

Check the workspace status:

```bash
kubectl get workspace default
```

Output:

```
NAME      PHASE        AGE
default   hibernated   5m
```

The module will automatically scale down when the workspace hibernates.

Wake up the workspace:

```bash
kubectl patch workspace default -p '{"spec":{"hibernated":false}}' --type=merge
```

## Step 5: Clean Up

Delete the module:

```bash
kubectl delete module redis
```

Delete the workspace:

```bash
kubectl delete workspace default
```

## What's Next?

### Learn More

- [Workspace CRD Reference](/reference/crds/workspace/) - Complete API documentation
- [Module CRD Reference](/reference/crds/module/) - Complete API documentation

### Common Use Cases

**Development Environments:**

```yaml
# Auto-hibernate outside business hours to save costs
spec:
  autoHibernation:
    enabled: true
    schedule: "0 18 * * 1-5" # 6 PM weekdays
    wakeSchedule: "0 8 * * 1-5" # 8 AM weekdays
```

**Testing Environments:**

```yaml
# Fork from production workspace
spec:
  type: kubernetes
  from:
    name: production-workspace
    namespace: prod
```

**Staging Environments:**

```yaml
# Deploy a PostgreSQL Helm chart
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
            size: "50Gi"
          replication:
            enabled: true
            slaveReplicas: 2
```

## Troubleshooting

### Workspace Not Ready

Check the workspace status:

```bash
kubectl describe workspace dev-workspace
```

Look at the `Conditions` section for error messages.

### Module Installation Failed

Check the module status:

```bash
kubectl describe module nginx-app
```

Check operator logs:

```bash
kubectl logs -n forkspacer-system deployment/forkspacer-controller-manager
```
