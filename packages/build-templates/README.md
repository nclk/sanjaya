# @pojagi/build-templates

Build-time tool that converts `.template.html` files into TypeScript modules with the HTML exported as a string constant.

## Why?

Web Components need HTML templates, but inlining them in TypeScript means:
- No syntax highlighting for HTML/CSS
- Hard to read and maintain
- Poor editor support

This tool lets you:
1. **Write templates in `.html` files** with full editor support
2. **Build to `.ts`** as part of your package build
3. **Ship plain JS** - no bundler plugins required for consumers

## Usage

### 1. Install as a dev dependency

```bash
pnpm add -D @pojagi/build-templates
```

### 2. Add to your build script

```json
{
  "scripts": {
    "build": "build-templates && tsc",
    "dev": "build-templates && tsc --watch"
  }
}
```

### 3. Create template files

Create `my-component.template.html`:

```html
<style>
  :host { display: block; }
  .container { padding: 1rem; }
</style>

<div class="container">
  <slot></slot>
</div>
```

### 4. Import in your component

```typescript
import { template } from './my-component.template';

const tpl = document.createElement('template');
tpl.innerHTML = template;

class MyComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.appendChild(tpl.content.cloneNode(true));
  }
}
```

## CLI Options

```bash
# Default: searches ./src
build-templates

# Custom directory
build-templates ./src/components
```

## Generated Files

The generated `.template.ts` files should be:
- Added to `.gitignore` (they're build artifacts)
- Not manually edited (changes will be overwritten)

Add to your `.gitignore`:
```
*.template.ts
```

## How It Works

1. Finds all `*.template.html` files recursively
2. Escapes the content for use in a template literal
3. Writes a `.template.ts` file next to each `.html` file
4. The `.ts` file exports a single `template` string constant
