import { Component } from '@theme/component';
import { getFlyToCartDestination } from '@theme/utilities';
import { StandardEvents } from '@shopify/events';

/** How long a chosen option shows "Added" before the panel closes. */
const CLOSE_AFTER_ADD_MS = 900;

/**
 * Slide-up variant picker on product cards (snippets/card-variant-picker.liquid). The cart button opens
 * a panel of variants; choosing one writes its ID to the product form, which then submits through
 * product-form-component like any add to cart. This component only handles the panel, focus, and the
 * fly-to-cart animation.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement} toggle - The card's cart button that opens the panel.
 * @property {HTMLElement} panel - The variant panel.
 *
 * @extends {Component<Refs>}
 */
class CardVariantPicker extends Component {
  requiredRefs = ['toggle', 'panel'];

  /** @type {AbortController | undefined} */
  #abortController;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #closeTimer;

  /** @type {HTMLButtonElement | null} */
  #pendingOption = null;

  connectedCallback() {
    super.connectedCallback();
    this.#setUp();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#setUp();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
    clearTimeout(this.#closeTimer);
  }

  #setUp() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (this.#isOpen && event.target instanceof Node && !this.contains(event.target)) this.close();
      },
      { signal }
    );

    // Confirm the chosen option once the cart has actually accepted it.
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate, { signal });
  }

  get #isOpen() {
    return !this.refs.panel.hidden;
  }

  /** @returns {HTMLButtonElement[]} */
  get #options() {
    return Array.from(this.refs.panel.querySelectorAll('.card-variant-picker__option'));
  }

  /**
   * Opens the panel and focuses the first available option.
   */
  open() {
    const { toggle, panel } = this.refs;
    clearTimeout(this.#closeTimer);
    this.#resetOptions();
    this.#pendingOption = null;

    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    this.closest('.category-product-card')?.classList.add('category-product-card--picking');

    this.#options.find((option) => !option.disabled)?.focus({ preventScroll: true });
  }

  /**
   * Closes the panel.
   * @param {Event | boolean} [restoreFocus] - Moves focus back to the cart button. A click on the close
   *   button passes its event, which also restores focus.
   */
  close(restoreFocus = false) {
    const { toggle, panel } = this.refs;
    if (!this.#isOpen) return;

    clearTimeout(this.#closeTimer);
    const focusWasInside = panel.contains(document.activeElement);

    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    this.closest('.category-product-card')?.classList.remove('category-product-card--picking');

    if (restoreFocus || focusWasInside) toggle.focus({ preventScroll: true });
  }

  /**
   * Runs on an option's click, before its form submits: points the form at that variant and starts
   * the fly-to-cart animation.
   * @param {MouseEvent} event
   */
  choose(event) {
    // The framework passes the element carrying on:click as the event target.
    const button = event.target instanceof Element ? event.target.closest('.card-variant-picker__option') : null;
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const input = this.refs.panel.querySelector('input[name="id"]');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = button.dataset.variantId ?? '';

    this.#pendingOption = button;
    this.#flyToCart(button);
  }

  /**
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const options = this.#options.filter((option) => !option.disabled);
    const index = options.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (index === -1) return;

    event.preventDefault();
    const next = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1) : Math.max(index - 1, 0);
    options[next]?.focus();
  }

  /**
   * @param {Event & {promise?: Promise<unknown>}} event
   */
  #handleCartUpdate = (event) => {
    const option = this.#pendingOption;
    if (!option) return;
    this.#pendingOption = null;

    const settle = event.promise ?? Promise.resolve();
    settle
      .then(() => {
        option.dataset.added = 'true';
        clearTimeout(this.#closeTimer);
        this.#closeTimer = setTimeout(() => this.close(), CLOSE_AFTER_ADD_MS);
      })
      .catch(() => {
        // The product form shows the error; keep the panel open so another option can be chosen.
      });
  };

  #resetOptions() {
    for (const option of this.#options) option.removeAttribute('data-added');
  }

  /**
   * Flies the variant image from the chosen option to the visible cart icon.
   * @param {HTMLElement} source
   */
  #flyToCart(source) {
    const image = source.dataset.variantMedia;
    const destination = getFlyToCartDestination();
    const animationEnabled = this.dataset.addToCartAnimation !== 'false';
    if (!image || !destination || !animationEnabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const flyToCart = /** @type {HTMLElement & {source: Element, destination: Element}} */ (
      document.createElement('fly-to-cart')
    );
    flyToCart.classList.add('fly-to-cart--quick');
    flyToCart.style.setProperty('background-image', `url(${image})`);
    flyToCart.style.setProperty('--start-opacity', '0');
    flyToCart.source = source;
    flyToCart.destination = destination;
    document.body.appendChild(flyToCart);
  }
}

if (!customElements.get('card-variant-picker')) {
  customElements.define('card-variant-picker', CardVariantPicker);
}
