import { ThemeEvents } from '@theme/events';
import { Component } from '@theme/component';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * @typedef {Object} ProductPriceRefs
 * @property {HTMLElement} priceContainer
 * @property {HTMLElement} [volumePricingNote]
 * @property {HTMLScriptElement} [variantPrices] - Pre-formatted variant prices for instant updates (product page).
 */

/**
 * @typedef {Object} VariantPriceData
 * @property {boolean} instant - False for variants with volume or unit pricing.
 * @property {string} price - Formatted price.
 * @property {string} compare - Formatted compare-at price.
 * @property {boolean} onSale - Whether the compare-at price is higher than the price.
 */

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 * It handles price updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 *
 * @extends {Component<ProductPriceRefs>}
 */
class ProductPrice extends Component {
  connectedCallback() {
    super.connectedCallback();
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    closestSection.addEventListener('change', this.#handleVariantInputChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.removeEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    closestSection.removeEventListener('change', this.#handleVariantInputChange);
  }

  /**
   * Shows the picked variant's price immediately, from the pre-formatted prices in the page, without waiting
   * for the section re-render. The re-render then replaces it with the same server-rendered markup.
   * @param {Event} event - The change event from a variant picker input or select.
   */
  #handleVariantInputChange = (event) => {
    const { target } = event;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (!target.closest('variant-picker') || target.closest('product-card')) return;

    const option = target instanceof HTMLSelectElement ? target.selectedOptions[0] : target;
    const variantId = option?.dataset.variantId;
    if (!variantId) return;

    const data = this.#readVariantPrices();
    const variant = data?.variants?.[variantId];
    if (!data || !variant?.instant || !variant.price) return;

    this.#renderPrice(variant, data);
  };

  /** @returns {{ saleFirst: boolean, labels: { sale: string, regular: string }, variants: Record<string, VariantPriceData> } | null} */
  #readVariantPrices() {
    const script = this.refs.variantPrices;
    if (!script?.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  }

  /**
   * Rebuilds the price container with the same structure as snippets/price.liquid's standard branch.
   * @param {VariantPriceData} variant
   * @param {{ saleFirst: boolean, labels: { sale: string, regular: string } }} data
   */
  #renderPrice(variant, { saleFirst, labels }) {
    const { priceContainer } = this.refs;
    if (!priceContainer) return;

    /**
     * @param {string} className
     * @param {string} value
     * @param {string} [label]
     */
    const group = (className, value, label) => {
      const span = document.createElement('span');
      span.className = className;
      if (label) {
        const hidden = document.createElement('span');
        hidden.className = 'visually-hidden';
        hidden.textContent = `${label} `;
        span.append(hidden);
      }
      const bdi = document.createElement('bdi');
      bdi.textContent = value;
      span.append(bdi);
      return span;
    };

    if (variant.onSale) {
      const sale = group('price-item__group price', variant.price, labels.sale);
      const regular = group('price-item__group price-item--regular compare-at-price', variant.compare, labels.regular);
      priceContainer.replaceChildren(...(saleFirst ? [sale, regular] : [regular, sale]));
    } else {
      priceContainer.replaceChildren(group('price', variant.price));
    }
  }

  /**
   * Handles product select event and updates the price.
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html, newProduct } = detail;

        if (newProduct) {
          this.dataset.productId = newProduct.id;
        } else if (detail.productId && detail.productId !== this.dataset.productId) {
          return;
        }

        const { priceContainer, volumePricingNote } = this.refs;
        // Find the new product-price element in the updated HTML
        const newProductPrice = html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`);
        if (!newProductPrice) return;

        // Update price container
        const newPrice = newProductPrice.querySelector('[ref="priceContainer"]');
        if (newPrice && priceContainer) {
          priceContainer.replaceWith(newPrice);
        }

        // Update volume pricing note
        const newNote = newProductPrice.querySelector('[ref="volumePricingNote"]');
        if (!newNote) {
          volumePricingNote?.remove();
        } else if (!volumePricingNote) {
          // Use newPrice since priceContainer was just replaced and now points to the detached element
          newPrice?.insertAdjacentElement('afterend', /** @type {Element} */ (newNote.cloneNode(true)));
        } else {
          volumePricingNote.replaceWith(newNote);
        }

        // Update installments (SPI banner) variant ID to trigger payment terms re-render
        const installmentsInput = /** @type {HTMLInputElement|null} */ (
          this.querySelector(`#product-form-installment-${this.dataset.blockId} input[name="id"]`)
        );
        if (installmentsInput) {
          installmentsInput.value = detail.resource?.id ?? '';
          installmentsInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[product-price] Event promise rejected:', error);
      });
  };
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
