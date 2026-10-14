import Lenis from '@theme/lenis';
import { scrollContainerMediaQuery } from '@theme/scroll-container';

/**
 * Smooth inertia scrolling for mouse wheels and trackpads (Theme settings > Animations).
 *
 * Lenis animates the real scroll position, so sticky elements, IntersectionObservers, and scroll
 * listeners keep working. It runs on the page's scroll container: `.page-wrapper` in the desktop
 * squeeze layout, the document below 990px. It is skipped for reduced-motion preferences and touch-only
 * devices, pauses while the theme locks scrolling, and leaves nested scroll areas (drawers, dialogs,
 * dropdowns) to native scrolling.
 */

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const PAGE_WRAPPER_SELECTOR = '.page-wrapper';

/** @type {Lenis | null} */
let lenis = null;
/** @type {MutationObserver | null} */
let scrollLockObserver = null;

/** @returns {number} Interpolation per frame; higher intensity means a longer, softer glide. */
function getLerp() {
  const intensity = Number(document.documentElement.dataset.smoothScrollIntensity || 5);
  return Math.min(0.2, Math.max(0.04, 0.16 - intensity * 0.012));
}

/**
 * Nested scrollable areas and overlays keep native scrolling.
 * @param {HTMLElement} node
 * @param {Element | Window} wrapper
 */
function isNativeScrollArea(node, wrapper) {
  if (node === wrapper) return false;
  if (node.matches('dialog, [role="dialog"], .menu-drawer, [data-lenis-prevent]')) return true;

  const { overflowY } = getComputedStyle(node);
  return (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
}

function start() {
  stop();
  if (reducedMotionQuery.matches || !finePointerQuery.matches) return;

  const pageWrapper = document.querySelector(PAGE_WRAPPER_SELECTOR);
  const usesPageWrapper = scrollContainerMediaQuery.matches && pageWrapper instanceof HTMLElement;
  /** @type {HTMLElement | Window} */
  const wrapper = usesPageWrapper ? pageWrapper : window;

  lenis = new Lenis({
    wrapper,
    content: usesPageWrapper ? pageWrapper : document.documentElement,
    lerp: getLerp(),
    smoothWheel: true,
    syncTouch: false,
    autoRaf: true,
    prevent: (node) => isNativeScrollArea(node, wrapper),
  });

  // The theme marks <html scroll-lock> while drawers and modals are open.
  const syncScrollLock = () => {
    if (document.documentElement.hasAttribute('scroll-lock')) lenis?.stop();
    else lenis?.start();
  };
  scrollLockObserver = new MutationObserver(syncScrollLock);
  scrollLockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['scroll-lock'] });
  syncScrollLock();
}

function stop() {
  scrollLockObserver?.disconnect();
  scrollLockObserver = null;
  lenis?.destroy();
  lenis = null;
}

start();
scrollContainerMediaQuery.addEventListener('change', start);
reducedMotionQuery.addEventListener('change', start);
finePointerQuery.addEventListener('change', start);
