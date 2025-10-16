---
title: Overview
description: Guide for contributing to and developing the Forkspacer operator
sidebar:
  order: 1
---

This guide covers the development workflow for contributing to the Forkspacer operator, including setting up your development environment, building, testing, and running the operator locally.

## Prerequisites

Before you begin development, ensure you have the following tools installed:

- **Go** (v1.24 or later) - The operator is written in Go
- **Docker** or **Podman** - For building container images
- **kubectl** (v1.20 or later) - Kubernetes command-line tool
- **Kind** (Kubernetes in Docker) - Recommended for local development
- **Git** - Version control

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/forkspacer/forkspacer.git
cd forkspacer/forkspacer
```

### 2. Install Dependencies

The project uses Go modules. Dependencies will be downloaded automatically, but you can explicitly install them:

```bash
go mod download
```

### 3. Install Development Tools

The Makefile will automatically install required tools (controller-gen, kustomize, etc.) when needed. These tools are installed in the local `bin/` directory:

```bash
make help  # View available commands
```

## Common Development Workflows

### Running the Operator

#### Option 1: Run on Host (Quick Testing)

For rapid iteration, run the operator directly on your host machine:

```bash
# First, install CRDs if not already installed
make install

# Run the operator on your host
make dev-host
```

This runs the operator against your current kubeconfig context. It's useful for:

- Quick testing of controller logic
- Debugging with your IDE
- Fast iteration without image builds

**Important Notes:**

- **Webhooks are disabled** - The operator runs with `ENABLE_WEBHOOKS=false`, so validation and defaulting webhooks won't be active
- **Use `local` connection type** - When creating Workspaces in dev-host mode, use `type: local` instead of `type: in-cluster` for the connection configuration
- Your kubeconfig must point to a running cluster (Kind, minikube, etc.)

**Example Workspace for dev-host mode:**

```yaml
apiVersion: batch.forkspacer.com/v1
kind: Workspace
metadata:
  name: dev-workspace
  namespace: default
spec:
  type: kubernetes
  connection:
    type: local # Use 'local' when running with dev-host
    secretReference:
      name: local
```

#### Option 2: Run in Kind Cluster (Recommended)

For a complete, isolated development environment, use Kind:

```bash
make dev-kind
```

This will:

1. Delete any existing `operator-dev` Kind cluster
2. Create a fresh Kind cluster
3. Install cert-manager
4. Install CRDs
5. Build the operator image
6. Load the image into Kind
7. Deploy the operator

**Benefits of Kind Development:**

- Isolated environment that won't affect other clusters
- Tests the full deployment process
- Validates webhook configurations
- Mimics production deployment

**Cleanup:**

```bash
make cleanup-dev-kind
```

### Code Generation

When you modify API types (`api/v1/*.go`), you need to regenerate manifests and code:

```bash
# Generate CRDs, RBAC, and webhook configurations
make manifests

# Generate DeepCopy, DeepCopyInto, and DeepCopyObject methods
make generate
```

These commands use `controller-gen` and are automatically run as part of `make build`.

### Code Quality

#### Format Code

```bash
make fmt
```

#### Run Static Analysis

```bash
make vet
```

#### Run Linter

```bash
# Run golangci-lint
make lint

# Run linter with auto-fix
make lint-fix

# Verify linter configuration
make lint-config
```

## Testing

### Unit Tests

Run unit tests with coverage:

```bash
make test
```

This runs all tests except e2e tests and generates a coverage report in `cover.out`.

### End-to-End Tests

E2E tests run against a real Kubernetes cluster (Kind):

```bash
make test-e2e
```

This will:

1. Create a Kind cluster named `operator-test-e2e` (if it doesn't exist)
2. Run e2e tests using Ginkgo
3. Clean up the Kind cluster after tests complete

**Manual cleanup** (if needed):

```bash
make cleanup-test-e2e
```

## Deploying to a Cluster

### Install CRDs Only

```bash
make install
```

### Deploy the Operator

```bash
# Build image
make docker-build IMG=myregistry/forkspacer:dev

# Load into Kind (if using Kind)
kind load docker-image myregistry/forkspacer:dev -n operator-dev

# Deploy to cluster
make deploy IMG=myregistry/forkspacer:dev
```

### Undeploy the Operator

```bash
make undeploy
```

### Uninstall CRDs

```bash
make uninstall
```

## Building Release Artifacts

### Generate Installation Manifest

Create a consolidated YAML for installation:

```bash
make build-installer
```

This generates `dist/install.yaml` containing all CRDs and deployment manifests.

### Multi-Platform Build

Build and push images for multiple architectures:

```bash
make docker-buildx IMG=myregistry/forkspacer:v1.0.0
```

Platforms: `linux/arm64`, `linux/amd64`, `linux/s390x`, `linux/ppc64le`

## Development Tips

### Debugging

1. **Enable verbose logging**: Set environment variable before running:

   ```bash
   export LOG_LEVEL=debug
   make dev-host
   ```

2. **Use delve for debugging**:

   ```bash
   dlv debug ./cmd/main.go
   ```

3. **Check operator logs in cluster**:
   ```bash
   kubectl logs -n forkspacer-system deployment/forkspacer-controller-manager -f
   ```

### Rapid Iteration

For the fastest development cycle:

1. Run operator on host: `make dev-host`
2. Make code changes
3. Stop the operator (Ctrl+C)
4. Run `make manifests generate` if you changed API types
5. Restart with `make dev-host`

### Working with Webhooks

Webhooks require TLS certificates, which makes local development challenging. When running on host:

- Webhooks are **disabled** by default in `dev-host` mode
- Use `dev-kind` to test webhook functionality
- Webhook code is in `internal/webhook/`

### Version Management

The version is controlled by variables in the Makefile:

```makefile
VERSION ?= v0.1.3
```

To build with a custom version:

```bash
make build VERSION=v0.2.0-dev
```

## Contributing Workflow

1. **Fork the repository** on GitHub
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Make your changes** following the project structure
4. **Run tests and linting**:
   ```bash
   make test lint
   ```
5. **Commit your changes** with clear commit messages
6. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```
7. **Open a Pull Request** on GitHub

## Next Steps

- [Custom Module Development](/development/custom-module/) - Learn how to create custom modules
- [API Reference](/reference/crds/overview/) - Understand the CRD specifications
