const DEFAULT_BASE_URI = "http://localhost:3001";

const input = document.getElementById("baseUri");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.sync.get("baseUri", ({ baseUri }) => {
  input.value = baseUri ?? DEFAULT_BASE_URI;
});

saveBtn.addEventListener("click", () => {
  const value = input.value.trim().replace(/\/$/, "");
  if (!value) return;
  chrome.storage.sync.set({ baseUri: value }, () => {
    status.textContent = "Saved.";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
});
