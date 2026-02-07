/* =========================
   Main JavaScript file
   ========================= */

/* Run when page loads */
document.addEventListener("DOMContentLoaded", () => {
    console.log("Website loaded successfully");
});

/* Example function (you can reuse later) */
function toggleVisibility(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (el.style.display === "none") {
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}
