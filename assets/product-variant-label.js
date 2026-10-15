import { Component } from '@theme/component';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * Shows the selected variant's name and keeps it in sync with the variant picker.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} label - The element that displays the variant name.
 * @property {HTMLScriptElement} [titles] - Variant names by ID, for instant updates.
 *
 * @extends {Component<Refs>}
 */
class ProductVariantLabel extends Component {
  requiredRefs = ['label'];

  /** @type {Element | null} */
  #target = null;

  connectedCallback() {
    super.connectedCallback();
    this.#target = this.closest('[id*="ProductInformation-"], [id*="QuickAdd-"], .shopify-section');
    this.#target?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.#target?.addEventListener('change', this.#handleVariantInputChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#target?.removeEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.#target?.removeEventListener('change', this.#handleVariantInputChange);
    this.#target = null;
  }

  /**
   * Shows the picked variant's name immediately; the product select event confirms it after the re-render.
   * @param {Event} event - The change event from a variant picker input or select.
   */
  #handleVariantInputChange = (event) => {
    const { target } = event;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (!target.closest('variant-picker') || target.closest('product-card')) return;

    const option = target instanceof HTMLSelectElement ? target.selectedOptions[0] : target;
    const variantId = option?.dataset.variantId;
    const json = this.refs.titles?.textContent;
    if (!variantId || !json) return;

    try {
      const title = JSON.parse(json)[variantId];
      if (!title) return;
      this.refs.label.textContent = title;
      this.hidden = false;
    } catch {
      // Leave the label for the server-rendered update.
    }
  };

  /**
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    event.promise
      .then(({ detail }) => {
        if (!detail) return;

        const { newProduct, resource } = detail;
        if (newProduct) this.dataset.productId = newProduct.id;
        if (detail.productId && detail.productId !== this.dataset.productId) return;
        if (!resource) return;

        // public_title is empty for products that only have the default variant.
        const label = resource.public_title || '';
        this.refs.label.textContent = label;
        this.hidden = !label;
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[product-variant-label] Event promise rejected:', error);
      });
  };
}

if (!customElements.get('product-variant-label')) {
  customElements.define('product-variant-label', ProductVariantLabel);
}
