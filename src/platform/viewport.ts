export function keyboardVisible(
  layoutHeight: number,
  visualHeight: number,
  scale: number,
  textFocused: boolean,
) {
  // Pinch zoom also shrinks the visual viewport; it must not be treated as a keyboard.
  return (
    textFocused &&
    Math.abs(scale - 1) < 0.05 &&
    layoutHeight - visualHeight > 120
  );
}
export function isTextInput(element: Element | null) {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      ["text", "search", "email", "url", "tel", "number", "password"].includes(
        element.type,
      ))
  );
}
export function installViewportTracking() {
  const root = document.documentElement,
    viewport = window.visualViewport;
  let frame = 0,
    revealTimer = 0;
  function reveal() {
    const input = document.activeElement;
    if (!isTextInput(input) || root.dataset.keyboard !== "open") return;
    const element = input as HTMLElement,
      rect = element.getBoundingClientRect();
    const top = (viewport?.offsetTop || 0) + 64,
      bottom =
        (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 64;
    // Leave caret tracking inside a tall textarea to Safari itself.
    if (rect.height > bottom - top) return;
    const delta =
      rect.bottom > bottom
        ? rect.bottom - bottom
        : rect.top < top
          ? rect.top - top
          : 0;
    if (!delta) return;
    const panel = element.closest(".modal-content");
    if (panel) panel.scrollTop += delta;
    else window.scrollBy({ top: delta, behavior: "instant" });
  }
  function update() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.style.setProperty(
        "--visible-height",
        `${viewport?.height || innerHeight}px`,
      );
      root.style.setProperty("--visible-top", `${viewport?.offsetTop || 0}px`);
      root.dataset.keyboard = keyboardVisible(
        innerHeight,
        viewport?.height || innerHeight,
        viewport?.scale || 1,
        isTextInput(document.activeElement),
      )
        ? "open"
        : "closed";
    });
  }
  function resized() {
    update();
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(reveal, 180);
  }
  viewport?.addEventListener("resize", resized);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", resized);
  document.addEventListener("focusin", resized);
  document.addEventListener("focusout", update);
  update();
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(revealTimer);
    viewport?.removeEventListener("resize", resized);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", resized);
    document.removeEventListener("focusin", resized);
    document.removeEventListener("focusout", update);
    delete root.dataset.keyboard;
    root.style.removeProperty("--visible-height");
    root.style.removeProperty("--visible-top");
  };
}
