---
title: Installation
description: How to install the Forkspacer operator in your Kubernetes cluster
sidebar:
    order: 1
---

# Installing Forkspacer

This guide walks you through installing the Forkspacer operator in your Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (v1.20 or later)
- `kubectl` configured to access your cluster
- Cluster admin permissions

## Installation Steps

### 1. Install cert-manager

Forkspacer requires [cert-manager](https://cert-manager.io/) for managing TLS certificates used by webhooks.

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml
```

Wait for cert-manager to be ready:

```bash
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
```

### 2. Deploy Forkspacer

Install the Forkspacer operator and Custom Resource Definitions (CRDs):

```bash
kubectl apply -f https://raw.githubusercontent.com/forkspacer/forkspacer/main/dist/install.yaml
```

### 3. Verify Installation

Check that the operator is running:

```bash
kubectl get pods -n forkspacer-system
```

You should see the operator pod in `Running` state:

```
NAME                                          READY   STATUS    RESTARTS   AGE
forkspacer-controller-manager-xxxxxxxxx-xxxxx   1/1     Running   0          30s
```

Verify the CRDs are installed:

```bash
kubectl get crds | grep batch.environment.sh
```

You should see:

```
modules.batch.environment.sh
workspaces.batch.environment.sh
```

## What's Next?

- [Quick Start Guide](/guides/quick-start/) - Create your first workspace and deploy a module
- [Creating Workspaces](/reference/crds/workspace/) - Learn about workspace management
- [Deploying Modules](/reference/crds/module/) - Deploy applications into workspaces

## Troubleshooting

### cert-manager Installation Issues

If cert-manager pods are not starting, check the logs:

```bash
kubectl logs -n cert-manager deployment/cert-manager
```

Ensure your Kubernetes version is v1.19 or later:

```bash
kubectl version --short
```

### Operator Not Starting

Check the operator logs:

```bash
kubectl logs -n forkspacer-system deployment/forkspacer-controller-manager
```

Ensure all required CRDs are installed:

```bash
kubectl get crds | grep batch.environment.sh
```

## Uninstallation

To remove Forkspacer from your cluster:

```bash
# Delete all workspaces and modules first
kubectl delete workspaces --all -A
kubectl delete modules --all -A

# Remove the operator
kubectl delete -f https://raw.githubusercontent.com/forkspacer/forkspacer/main/dist/install.yaml

# Optionally remove cert-manager
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml
```
