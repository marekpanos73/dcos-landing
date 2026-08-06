export function initButtonLabels() {
  document.querySelectorAll(".btn").forEach((btn) => {
    const text = btn.textContent.trim();
    if (!text) return;

    const label = document.createElement("span");
    label.className = "btn__label";

    const original = document.createElement("span");
    original.className = "btn__label-text";
    original.textContent = text;

    const duplicate = original.cloneNode(true);
    duplicate.setAttribute("aria-hidden", "true");

    label.append(original, duplicate);
    btn.textContent = "";
    btn.append(label);
  });
}
