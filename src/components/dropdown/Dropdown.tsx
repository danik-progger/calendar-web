import { type JSX, splitProps } from "solid-js";
import "./dropdown.css";

export function Dropdown(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, attributes] = splitProps(props, ["class"]);
  return <div {...attributes} class={local.class ? `dropdown ${local.class}` : "dropdown"} />;
}

export function DropdownButton(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" class="dropdown__row" />;
}
