export function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // TODO: wire up to the real submission endpoint once available.
  });
}
