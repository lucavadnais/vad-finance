// The height the on-screen keyboard covers at the bottom of the screen, in the
// --keyboard-inset CSS variable on <html> (0px without one). Phones do not move
// fixed elements up when it opens (iOS, Android's default): the bottom sheets
// sit above it with it (see ui/sheet/variants.ts). Set up once, at start.
export function trackKeyboardInset() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    // What the visible part leaves uncovered under it
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
}
