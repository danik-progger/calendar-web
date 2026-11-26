const cardSelector = ".event-card[data-event-id]:not([data-drop-preview]):not([data-event-ghost])";
const fade = { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
const move = { duration: 240, easing: "cubic-bezier(0.77, 0, 0.175, 1)" };

function cards(board: HTMLElement) {
  return new Map(
    Array.from(board.querySelectorAll<HTMLElement>(cardSelector), (card) => [
      card.dataset.eventId,
      card,
    ]),
  );
}

function layout(card: HTMLElement) {
  const parent = card.offsetParent?.getBoundingClientRect();
  return [
    (parent?.left ?? 0) + card.offsetLeft,
    (parent?.top ?? 0) + card.offsetTop,
    card.offsetWidth,
    card.offsetHeight,
  ];
}

function visualCopy(node: HTMLElement) {
  const copy = node.cloneNode(true);
  if (!(copy instanceof HTMLElement)) throw new Error("Expected an event element");
  copy.setAttribute("aria-hidden", "true");
  copy.removeAttribute("data-testid");
  copy.inert = true;
  return copy;
}

function fadeAndRemove(node: HTMLElement, opacity = 1) {
  const animation = node.animate([{ opacity }, { opacity: 0 }], { ...fade, fill: "forwards" });
  void animation.finished.then(
    () => node.remove(),
    () => node.remove(),
  );
}

export function animateInitialEvents(board: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let delay = 0;
  for (const card of cards(board).values()) {
    card.animate([{ opacity: 0 }, { opacity: 1 }], { ...fade, delay, fill: "backwards" });
    delay = Math.min(delay + 8, 80);
  }
}

export function captureEventMotion(board: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

  const before = new Map(
    Array.from(cards(board), ([id, card]) => {
      const copy = card.querySelector<HTMLElement>(".event-card__copy:not([aria-hidden])");
      return [
        id,
        {
          card,
          parent: card.parentElement,
          rect: card.getBoundingClientRect(),
          layout: layout(card),
          content: copy?.textContent,
          copy: copy && visualCopy(copy),
        },
      ];
    }),
  );
  return () => {
    if (!board.isConnected) return;
    const after = cards(board);
    for (const [id, card] of after) {
      const old = before.get(id);
      if (!old) {
        card.animate([{ opacity: 0 }, { opacity: 1 }], fade);
        continue;
      }
      const target = layout(card);
      if (target.some((value, index) => value !== old.layout[index])) {
        card
          .getAnimations()
          .find((animation) => animation.id === "event-move")
          ?.cancel();
        const rect = card.getBoundingClientRect();
        if (rect.width && rect.height) {
          const animation = card.animate(
            [
              {
                transform: `translate(${old.rect.x - rect.x}px, ${old.rect.y - rect.y}px) scale(${old.rect.width / rect.width}, ${old.rect.height / rect.height})`,
                transformOrigin: "top left",
              },
              { transform: "none", transformOrigin: "top left" },
            ],
            move,
          );
          animation.id = "event-move";
        }
      }
      const copy = card.querySelector<HTMLElement>(".event-card__copy:not([aria-hidden])");
      if (copy && old.copy && copy.textContent !== old.content) {
        card.querySelector(".event-card__copy[aria-hidden]")?.remove();
        card.append(old.copy);
        fadeAndRemove(old.copy);
        copy.getAnimations().forEach((animation) => animation.cancel());
        copy.animate([{ opacity: 0 }, { opacity: 1 }], fade);
      }
    }

    for (const [id, { card, parent, rect }] of before) {
      if (after.has(id) || !parent?.isConnected || !rect.width || !rect.height) continue;
      const ghost = visualCopy(card);
      const origin = parent.getBoundingClientRect();
      ghost.dataset.eventGhost = "";
      ghost.removeAttribute("data-event-id");
      ghost.querySelector(".event-card__resize-handle")?.remove();
      Object.assign(ghost.style, {
        position: "absolute",
        left: `${rect.left - origin.left}px`,
        top: `${rect.top - origin.top}px`,
        right: "auto",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        pointerEvents: "none",
      });
      parent.append(ghost);
      fadeAndRemove(ghost, card.dataset.dragging ? 0.24 : 1);
    }
  };
}
