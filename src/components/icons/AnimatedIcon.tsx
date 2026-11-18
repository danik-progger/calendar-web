import { onCleanup, onMount } from "solid-js";
import { createIcon, type IconData } from "@animateicons/vanilla";

export function AnimatedIcon(props: { icon: IconData; size: number }) {
  let host!: HTMLSpanElement;
  onMount(() => {
    const icon = createIcon(props.icon, { size: props.size });
    icon.setAttribute("aria-hidden", "true");
    host.replaceChildren(icon);
    const trigger = host.closest<HTMLElement>("button, label") ?? host;
    const start = () => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) icon.startAnimation();
    };
    const press = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") start();
    };
    trigger.addEventListener("pointerdown", press);
    trigger.addEventListener("mouseenter", start);
    trigger.addEventListener("mouseleave", icon.stopAnimation);
    trigger.addEventListener("focusin", start);
    trigger.addEventListener("focusout", icon.stopAnimation);
    onCleanup(() => {
      trigger.removeEventListener("pointerdown", press);
      trigger.removeEventListener("mouseenter", start);
      trigger.removeEventListener("mouseleave", icon.stopAnimation);
      trigger.removeEventListener("focusin", start);
      trigger.removeEventListener("focusout", icon.stopAnimation);
      icon.destroy();
    });
  });
  return <span ref={host} class="animated-icon" aria-hidden="true" />;
}
