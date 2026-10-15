import { Component } from '@theme/component';

/**
 * Floating action buttons (sections/floating-actions.liquid). Shows the cart button only while the
 * header is out of view. With a "show on scroll up" header that means: shown while scrolling down,
 * hidden again once the header slides back in. The data-visible attribute also tells
 * getFlyToCartDestination (assets/utilities.js) where add-to-cart animations should land.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [cart] - The floating cart button.
 *
 * @extends {Component<Refs>}
 */
class FloatingActions extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  /** @type {number | undefined} */
  #frame;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #settleTimer;

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
    if (this.#frame) cancelAnimationFrame(this.#frame);
    clearTimeout(this.#settleTimer);
  }

  #setUp() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    if (!this.refs.cart) return;

    const { signal } = this.#abortController;
    window.addEventListener('scroll', this.#schedule, { passive: true, signal });
    window.addEventListener('resize', this.#schedule, { passive: true, signal });

    // React as soon as header.js hides or reveals a sticky header.
    const header = this.#header;
    if (header) {
      const observer = new MutationObserver(this.#update);
      observer.observe(header, { attributes: true, attributeFilter: ['data-sticky-state'] });
      signal.addEventListener('abort', () => observer.disconnect());
    }

    this.#update();
  }

  /** @returns {HTMLElement | null} */
  get #header() {
    return document.querySelector('#header-component') ?? document.querySelector('header');
  }

  /**
   * Checks on the next frame, and again once the header's slide animation has had time to finish.
   */
  #schedule = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      this.#update();
    });

    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#update, 400);
  };

  #update = () => {
    const { cart } = this.refs;
    if (!cart) return;

    const visible = !this.#isHeaderVisible();
    if ((cart.dataset.visible === 'true') === visible) return;

    cart.dataset.visible = String(visible);
    cart.inert = !visible;
  };

  /** @returns {boolean} */
  #isHeaderVisible() {
    const header = this.#header;
    // Without a header, show the cart once the page is scrolled.
    if (!header) return window.scrollY < 200;

    // "Show on scroll up" headers are slid out of view in this state.
    if (header.dataset.stickyState === 'idle') return false;

    const rect = header.getBoundingClientRect();
    // A header slid up by "show on scroll up" leaves only a sliver; treat under 8px as hidden.
    return rect.bottom > 8 && rect.top < window.innerHeight;
  }
}

if (!customElements.get('floating-actions')) {
  customElements.define('floating-actions', FloatingActions);
}
