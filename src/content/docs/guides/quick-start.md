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
apiVersion: batch.environment.sh/v1
kind: Workspace
metadata:
  name: default
  namespace: default
spec:
  type: kubernetes
  connection:
    type: in-cluster
    secretReference:
      name: in-cluster
  autoHibernation:
    enabled: false
    schedule: "0 42 18 * * *"       # 6-field cron with seconds
    wakeSchedule: "0 44 18 * * *"
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
apiVersion: batch.environment.sh/v1
kind: Module
metadata:
  name: redis
  namespace: default
spec:
  source:
    raw:
      kind: Helm
      metadata:
        name: redis
        version: "1.0.0"
        supportedOperatorVersion: ">= 0.0.0, < 1.0.0"
        author: "platform-team"
        description: "Redis in-memory data store"
        category: "database"
        resource_usage:
          cpu: "200m"
          memory: "256Mi"

      config:
        - type: option
          name: "Redis Version"
          alias: "version"
          spec:
            editable: true
            required: false
            default: "21.2.9"
            values:
              - "21.2.9"
              - "21.2.7"
              - "21.2.6"

        - type: integer
          name: "Replica Count"
          alias: "replicaCount"
          spec:
            editable: true
            required: false
            default: 1
            min: 0
            max: 5

      spec:
        namespace: default
        repo: https://charts.bitnami.com/bitnami
        chartName: redis
        version: "{{.config.version}}"

        values:
          - raw:
              replica:
                replicaCount: "{{.config.replicaCount}}"

        outputs:
          - name: "Redis Hostname"
            value: "redis-master.default"
          - name: "Redis Password"
            valueFrom:
              secret:
                name: "{{.releaseName}}"
                key: redis-password
                namespace: default

        cleanup:
          removeNamespace: false
          removePVCs: true

  workspace:
    name: default
    namespace: default

  config:
    version: 21.2.7
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
