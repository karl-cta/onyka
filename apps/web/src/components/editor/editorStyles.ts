export const EDITOR_STYLES = `
  .fluid-editor {
    height: 100%;
  }

  .fluid-editor-content {
    font-family: var(--editor-font-family, 'Plus Jakarta Sans', sans-serif);
    font-size: var(--editor-font-size, 16px);
    line-height: 1.0;
    letter-spacing: 0.01em;
    color: var(--color-text-primary);
    min-height: 100%;
    transform: translateZ(0);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    contain: content;
    caret-color: var(--color-accent);
  }

  .fluid-editor-content .ProseMirror {
    outline: none;
  }

  .fluid-editor-content.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: var(--color-text-tertiary);
    pointer-events: none;
    height: 0;
  }

  .fluid-editor-content p {
    margin: 0.5em 0;
  }

  .fluid-editor-content h1 {
    font-size: 2em;
    font-weight: 800;
    margin: 1em 0 0.5em;
    padding-bottom: 0.35em;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
    background-image: linear-gradient(to right, var(--color-text-secondary), transparent);
    background-size: 100% 1px;
    background-position: bottom;
    background-repeat: no-repeat;
  }

  .fluid-editor-content h2 {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
    letter-spacing: -0.005em;
    color: var(--color-text-primary);
  }

  .fluid-editor-content h3 {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.6em 0 0.3em;
    color: var(--color-text-primary);
  }

  .fluid-editor-content ul {
    margin: 0.5em 0;
    padding-left: 1.5em;
    list-style-type: disc;
  }

  .fluid-editor-content ol {
    margin: 0.5em 0;
    padding-left: 1.5em;
    list-style-type: decimal;
  }

  .fluid-editor-content li {
    margin: 0.25em 0;
    display: list-item;
  }

  .fluid-editor-content li::marker {
    color: var(--color-text-secondary);
  }

  .fluid-editor-content blockquote {
    border-left: 3px solid var(--color-accent);
    margin: 1em 0;
    padding-left: 1em;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .fluid-editor-content code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9em;
    background: var(--color-bg-tertiary);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    color: var(--color-accent);
  }

  .fluid-editor-content pre {
    font-family: 'JetBrains Mono', monospace;
    background: var(--color-bg-tertiary);
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }

  .fluid-editor-content pre code {
    background: none;
    padding: 0;
    color: var(--color-text-primary);
  }

  .fluid-editor-content hr {
    border: none;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--color-text-secondary), transparent);
    margin: 2em 0;
  }

  .task-list {
    list-style: none !important;
    padding-left: 0 !important;
    margin: 0.5em 0;
  }

  .task-list .task-list {
    padding-left: 1.5em !important;
  }

  .task-item {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 0.5em;
    margin: 0;
    padding: 0.25em 0;
    list-style: none !important;
  }

  .task-item > label {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: calc((1.25em - 18px) / 2);
  }

  .task-item > label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid var(--color-border-strong);
    background: transparent;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    transition: background 0.15s ease, border-color 0.15s ease;
    margin: 0;
    flex-shrink: 0;
    position: relative;
  }

  .task-item > label input[type="checkbox"]:checked {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .task-item > label input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }

  .task-item > div {
    flex: 1;
    min-width: 0;
  }

  .task-item > div > p {
    margin: 0;
  }

  .task-item[data-checked="true"] > div {
    text-decoration: line-through;
    color: var(--color-text-tertiary);
  }

  .fluid-editor-content ::selection {
    background: var(--color-accent-muted);
  }

  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: var(--color-text-tertiary);
    pointer-events: none;
    height: 0;
  }

  /* Image styles */
  .image-wrapper {
    margin: 0.25em 0;
    display: flex;
  }

  .image-wrapper.image-align-left {
    justify-content: flex-start;
  }

  .image-wrapper.image-align-center {
    justify-content: center;
  }

  .image-wrapper.image-align-right {
    justify-content: flex-end;
  }

  .image-wrapper img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }

  .image-wrapper img:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .image-wrapper img.ProseMirror-selectednode {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  /* Border styles */
  .image-wrapper.image-border-simple img {
    border: 1px solid var(--color-border);
  }

  .image-wrapper.image-border-thick img {
    border: 3px solid var(--color-border-strong);
  }

  .image-wrapper.image-border-rounded img {
    border: 2px solid var(--color-border);
    border-radius: 16px;
  }

  .image-wrapper.image-border-shadow img {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .image-wrapper.image-border-polaroid img {
    background: white;
    padding: 8px 8px 32px 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  .editor-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 0.25em 0;
    display: block;
  }

  /* Columns layout styles */
  .editor-columns {
    display: flex;
    gap: 1.5rem;
    margin: 0.75em 0;
  }

  .editor-column {
    flex: 1;
    min-width: 0;
  }

  .editor-column:last-child {
    padding-left: 1.5rem;
    border-left: 1px solid var(--color-border);
  }

  /* Layout ratios */
  .editor-columns-1-1 .editor-column { flex: 1; }
  .editor-columns-1-2 .editor-column:first-child { flex: 1; }
  .editor-columns-1-2 .editor-column:last-child { flex: 2; }
  .editor-columns-2-1 .editor-column:first-child { flex: 2; }
  .editor-columns-2-1 .editor-column:last-child { flex: 1; }

  /* Reset margins for first/last children in columns */
  .editor-column > *:first-child {
    margin-top: 0;
  }

  .editor-column > *:last-child {
    margin-bottom: 0;
  }
`
