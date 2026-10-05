// Layout-shift check for the tracker: paste into the browser console on the
// tracker page (test data only: it ticks and unticks every checkbox). It
// unticks everything, then ticks and unticks each box in turn and reports any
// checkbox that moved; then repeats with Haal's Hourglass ticked. Expected
// result: "no shifts" both times, at every window width.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const boxes = () => [...document.querySelectorAll("table tbody input[type=checkbox], ul li input[type=checkbox]")];
  const snap = () => boxes().map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10]; });
  const label = (b) => {
    const td = b.closest("td");
    if (!td) { const card = b.closest("li > div > div") || b.parentElement; return (card.innerText || "").split("\n")[0]; }
    const col = [...td.parentElement.children].indexOf(td);
    return b.closest("table").querySelectorAll("thead th")[col].innerText.split("\n")[0] + "/" + td.parentElement.querySelector("td").innerText.split("\n")[0];
  };
  const NL = String.fromCharCode(10);
  const measure = async () => {
    const out = [];
    const n = boxes().length;
    for (let i = 0; i < n; i++) {
      const before = snap();
      const name = label(boxes()[i]);
      boxes()[i].click(); await sleep(700);
      const after = snap();
      boxes()[i].click(); await sleep(700);
      const back = snap();
      let tick = 0, untick = 0;
      for (let j = 0; j < before.length; j++) {
        if (after[j]) tick = Math.max(tick, Math.abs(after[j][0] - before[j][0]), Math.abs(after[j][1] - before[j][1]));
        if (back[j]) untick = Math.max(untick, Math.abs(back[j][0] - before[j][0]), Math.abs(back[j][1] - before[j][1]));
      }
      if (tick || untick) out.push(`${name} tick ${tick} untick ${untick}`);
    }
    return `${n} boxes: ${out.join(" | ") || "no shifts"}`;
  };
  // Start from nothing ticked.
  for (const b of boxes()) if (b.checked) { b.click(); await sleep(500); }
  const plain = await measure();
  // Then with Haal's Hourglass ticked for everyone.
  for (const b of boxes()) if (!b.checked && label(b).startsWith("Haal")) { b.click(); await sleep(500); }
  const withHaal = await measure();
  return `UNTICKED -> ${plain}${NL}HAAL ON -> ${withHaal}`;
})()
