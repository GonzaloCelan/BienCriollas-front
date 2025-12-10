export function showToast(message, isError = false) {
  const toast = document.createElement("div");

  const baseClasses =
    "fixed top-4 right-4 z-50 text-white text-xs px-4 py-2 rounded-lg shadow-lg " +
    "transition-all duration-300 opacity-0 translate-y-2 ";

  const colorClass = isError ? "bg-rose-600" : "bg-emerald-600";

  toast.className = baseClasses + colorClass;

  toast.textContent = message;
  document.body.appendChild(toast);

  // animación de entrada
  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
  });

  // desaparecer
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
