window.addEventListener("load", onLoad);

function onLoad() {
  // For all ".input-synced" elements, sync the values between sibling elements
  document.querySelectorAll(".input-synced").forEach((element) => {
    element.addEventListener("input", () => {
      let sibling = element.previousElementSibling || element.nextElementSibling;
      sibling.value = element.value;
    });
  });

  // For all ".input-synced" number elements, always make sure the min/max constraints are enforced
  document.querySelectorAll('.input-synced[type="number"]').forEach((element) => {
    element.addEventListener("change", () => {
      let min = element.min;
      let max = element.max;
      let clampedValue = Math.min(Math.max(element.value, min), max);
      element.value = clampedValue;
    });
  });
}