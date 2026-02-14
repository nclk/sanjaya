# @pojagi/sanjaya-ui

Reusable web-component report builder for the
[Sanjaya](../../README.md) dynamic reporting platform.

## Installation

```bash
npm install @pojagi/sanjaya-ui
```

## Quick start

```html
<script type="module">
  import '@pojagi/sanjaya-ui';
  import '@pojagi/sanjaya-ui/themes/light.css';
</script>

<sanjaya-report-builder></sanjaya-report-builder>

<script type="module">
  const builder = document.querySelector('sanjaya-report-builder');

  // Inject your data client (you implement the SanjayaDataClient interface)
  builder.client = myClient;
</script>
```

## Theming

Every component exposes `--sanjaya-*` CSS custom properties. Import one of
the bundled themes or define your own:

```css
@import '@pojagi/sanjaya-ui/themes/light.css';
/* Override any variable */
:root {
  --sanjaya-color-primary: #1976d2;
}
```

For MUI / React hosts, map your theme palette to the CSS variables:

```ts
const vars = {
  '--sanjaya-color-primary': theme.palette.primary.main,
  '--sanjaya-color-surface': theme.palette.background.paper,
};
```

## Data client

The components do **not** make HTTP calls directly. The host application
implements the `SanjayaDataClient` interface and injects it as a property.
See [src/types/client.ts](src/types/client.ts) for the full interface.

## Building

```bash
npm run build        # build-templates → tsc
```
