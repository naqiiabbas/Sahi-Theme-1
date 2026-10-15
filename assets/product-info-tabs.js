/**
 * "Write a Review" buttons in the product info tabs open the review app's own form.
 * Judge.me renders its own toggle inside the widget: `.jm-action-buttons__button` in the current widget,
 * `.jdgm-write-rev-link` in the legacy one. Clicking it opens the form.
 * Falls back to scrolling to the review widget when the app's toggle is not found.
 */
const APP_WRITE_REVIEW_SELECTOR = '.jm-action-buttons__button, .jdgm-write-rev-link';
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-write-review]') : null;
  if (!button) return;

  const panel = button.closest('.product-info-tabs__reviews');
  const app = panel?.querySelector('.product-info-tabs__app');
  if (!app) return;

  // The app's own button is visually hidden while ours is shown, but stays clickable.
  const appToggle = app.querySelector(APP_WRITE_REVIEW_SELECTOR);
  if (appToggle instanceof HTMLElement) {
    appToggle.click();
    return;
  }

  app.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
