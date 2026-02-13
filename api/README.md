# @pojagi/sanjaya-api

TypeSpec definitions for the **Sanjaya Dynamic Reporting API**.

## Quick start — generate OpenAPI locally

```bash
cd api
pnpm install
pnpm build          # emits tsp-output/@typespec/openapi3/openapi.yaml
```

## Using in another TypeSpec project

### 1. Install the package

```bash
# peer dependencies are required
npm install @pojagi/sanjaya-api @typespec/compiler @typespec/http
# or
pnpm add @pojagi/sanjaya-api @typespec/compiler @typespec/http
```

### 2. Import models

The package exposes its entry point via the `tspMain` field in `package.json`,
so you can import it by package name.  All data models live under the `Models`
namespace and the REST routes live under `Rest.Api.V1`.

```typespec
import "@pojagi/sanjaya-api";

using Models;

// Now you can reference any exported model, enum, or union:
// ColumnType, FilterGroup, DynamicReport, AggFunc, etc.
```

### 3. Import individual files

If you only need a subset of the definitions you can import specific files
instead of the top-level entry point:

```typespec
// Models only (no REST routes)
import "@pojagi/sanjaya-api/models/dynamic-reports.tsp";

// Error models only
import "@pojagi/sanjaya-api/models/errors.tsp";
```

### 4. Extend or compose

Because these are plain TypeSpec definitions you can extend models, intersect
them, or reference them in your own service definition:

```typespec
import "@pojagi/sanjaya-api";
import "@typespec/http";

using TypeSpec.Http;
using Models;

@service(#{ title: "My Reporting Service" })
namespace MyService;

model MyCustomReport {
  ...DynamicReport;           // spread all fields
  tenantId: string;           // add your own
}

@route("/custom-reports")
@get op list(): MyCustomReport[];
```

## Namespaces

| Namespace | Description |
|---|---|
| `Models` | All data models, enums, and error types |
| `Rest.Api.V1` | HTTP operations grouped by resource |

## Peer dependencies

| Package | Version |
|---|---|
| `@typespec/compiler` | `^1.9.0` |
| `@typespec/http` | `^1.9.0` |

## License

MIT
