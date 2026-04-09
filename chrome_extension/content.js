document.addEventListener("DOMContentLoaded", init);
if (document.readyState !== "loading") init();

function init() {
  for (const row of document.querySelectorAll("tr.athing.submission")) {
    const id = row.id;
    if (!id) continue;

    const titleLine = row.querySelector(".titleline");
    if (!titleLine) continue;

    const titleCell = titleLine.closest("td");

    const btnS = makeButton("(+)");
    const btnL = makeButton("(++)");
    titleLine.appendChild(btnS);
    titleLine.appendChild(btnL);

    const summaryS = makeSummaryDiv();
    const summaryL = makeSummaryDiv();
    titleCell.appendChild(summaryS);
    titleCell.appendChild(summaryL);

    btnS.addEventListener("click", () => onToggle(id, "S", btnS, "(+)", summaryS, btnL, "(++)", summaryL));
    btnL.addEventListener("click", () => onToggle(id, "L", btnL, "(++)", summaryL, btnS, "(+)", summaryS));
  }
}

function makeButton(label) {
  const btn = document.createElement("button");
  btn.className = "hn-summarize-btn";
  btn.textContent = label;
  return btn;
}

function makeSummaryDiv() {
  const div = document.createElement("div");
  div.className = "hn-summary";
  div.hidden = true;
  return div;
}

async function onToggle(id, style, btn, defaultLabel, summaryDiv, otherBtn, otherDefaultLabel, otherSummaryDiv) {
  // Close the other section
  otherSummaryDiv.hidden = true;
  otherBtn.textContent = otherDefaultLabel;

  // Toggle off if already showing
  if (!summaryDiv.hidden) {
    summaryDiv.hidden = true;
    btn.textContent = defaultLabel;
    return;
  }

  // Show cached summary immediately if already fetched
  if (summaryDiv.dataset.ready) {
    summaryDiv.hidden = false;
    btn.textContent = defaultLabel.replace(")", "−)");
    return;
  }

  btn.textContent = "(…)";
  btn.disabled = true;

  try {
    const res = await fetch(`http://localhost:3001/post/${id}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const post = await res.json();

    const text = style === "S" ? post.articleSummaryS : post.articleSummaryL;
    summaryDiv.textContent = text ?? "No summary available.";
    summaryDiv.dataset.ready = "1";
    summaryDiv.hidden = false;
    btn.textContent = defaultLabel.replace(")", "−)");
  } catch {
    summaryDiv.textContent = "Could not fetch summary.";
    summaryDiv.hidden = false;
    btn.textContent = "(!)";
  } finally {
    btn.disabled = false;
  }
}
