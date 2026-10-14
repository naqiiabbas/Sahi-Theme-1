import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Category tabs that switch between server-rendered product panels.
 * Without JavaScript the first category's products remain visible.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement[]} tabs - The category tab buttons.
 * @property {HTMLElement[]} panels - The product panels, one per tab.
 * @property {HTMLElement} [tablist] - The scrolling tab list.
 *
 * @extends {Component<Refs>}
 */
class CategoryProductTabs extends Component {
  requiredRefs = ['tabs', 'panels'];

  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    // The theme editor dispatches this on the selected block's element, which is a tab here.
    this.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal: this.#controller.signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }

  /** @returns {number} */
  get selectedIndex() {
    return Math.max(
      0,
      this.refs.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
    );
  }

  /**
   * Shows the panel for a tab. Indexes wrap around.
   * @param {number} index - The tab index.
   * @param {{ focus?: boolean }} [options]
   */
  select(index, { focus = false } = {}) {
    const { tabs, panels } = this.refs;
    if (!tabs.length) return;

    const next = (index + tabs.length) % tabs.length;

    tabs.forEach((tab, i) => {
      const selected = i === next;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel, i) => {
      panel.hidden = i !== next;
    });

    const tab = tabs[next];
    if (!tab) return;

    tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    if (focus) tab.focus();
  }

  /**
   * @param {MouseEvent} event - Click on a tab.
   */
  handleTabClick = (event) => {
    const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (!(tab instanceof HTMLButtonElement)) return;

    const index = this.refs.tabs.indexOf(tab);
    if (index >= 0) this.select(index);
  };

  /**
   * Arrow keys, Home, and End move between tabs and show their panels.
   * @param {KeyboardEvent} event
   */
  handleTabKeydown = (event) => {
    const isRtl = getComputedStyle(this).direction === 'rtl';
    const forward = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = isRtl ? 'ArrowRight' : 'ArrowLeft';
    const { selectedIndex } = this;

    switch (event.key) {
      case forward:
        event.preventDefault();
        this.select(selectedIndex + 1, { focus: true });
        break;
      case backward:
        event.preventDefault();
        this.select(selectedIndex - 1, { focus: true });
        break;
      case 'Home':
        event.preventDefault();
        this.select(0, { focus: true });
        break;
      case 'End':
        event.preventDefault();
        this.select(this.refs.tabs.length - 1, { focus: true });
        break;
    }
  };

  /** Shows the previous category. */
  showPrevious = () => {
    this.select(this.selectedIndex - 1);
  };

  /** Shows the next category. */
  showNext = () => {
    this.select(this.selectedIndex + 1);
  };

  /**
   * @param {Event} event - The theme editor's block select event.
   */
  #handleBlockSelect = (event) => {
    const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (!(tab instanceof HTMLButtonElement)) return;

    const index = this.refs.tabs.indexOf(tab);
    if (index >= 0) this.select(index);
  };
}

if (!customElements.get('category-product-tabs')) {
  customElements.define('category-product-tabs', CategoryProductTabs);
}
