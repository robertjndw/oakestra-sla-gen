import css from "@xyflow/react/dist/style.css?raw";

// React Flow's stylesheet is all global react-flow__* classes. Bundled as CSS it would end up in
// the emitted stylesheet, which the dashboard's addon build rejects, so it goes in at runtime.
// In the components layer, our utilities still beat it without !important.
export function injectXyflowStyles() {
  if (typeof document === "undefined" || document.querySelector("style[data-slagen-xyflow]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-slagen-xyflow", "");
  style.textContent = `@layer components {\n${css}\n}`;
  document.head.append(style);
}
