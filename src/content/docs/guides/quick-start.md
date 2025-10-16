---
title: Quick Start
description: Get started with Forkspacer in 5 minutes
sidebar:
    order: 2
---

# Quick Start Guide

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
spec:
  workspace:
    name: default
    namespace: default
  source:
    raw:
      kind: Helm
      metadata:
        name: redis
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
      spec:
        namespace: default
        repo: https://charts.bitnami.com/bitnami
        chartName: redis
        version: "18.0.0"
        values:
          - raw:
              image:
                repository: bitnamilegacy/redis
              global:
                security:
                  allowInsecureImages: true
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
    schedule: "0 18 * * 1-5"      # 6 PM weekdays
    wakeSchedule: "0 8 * * 1-5"   # 8 AM weekdays
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
# Deploy from HTTP-hosted resource definitions
spec:
  source:
    httpURL: https://example.com/resources/postgresql.yaml
  config:
    storageSize: "50Gi"
    replicas: 2
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
