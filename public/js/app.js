const state = {
  token: sessionStorage.getItem("hw-token") || "",
  user: null,
  branchId: sessionStorage.getItem("hw-branch") || "",
  challengeId: "",
  otpChallengeId: "",
  profiles: [],
  offline: false,
};

const NAV = [
  ["today", "Today", "ph-squares-four", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"]],
  ["patients", "Patients", "ph-users", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"]],
  ["calendar", "Appointments", "ph-calendar-blank", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"]],
  ["queue", "Queue", "ph-queue", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"]],
  ["physios", "Physio board", "ph-heartbeat", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"]],
  ["billing", "Billing", "ph-receipt", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"]],
  ["packages", "Packages", "ph-package", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"]],
  ["team", "Team", "ph-identification-badge", ["ORG_ADMIN", "BRANCH_ADMIN"]],
  ["reports", "Reports", "ph-chart-bar", ["ORG_ADMIN", "BRANCH_ADMIN"]],
  ["notifications", "Notifications", "ph-bell", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"]],
  ["audit", "Audit", "ph-shield-check", ["ORG_ADMIN", "BRANCH_ADMIN"]],
  ["settings", "Settings", "ph-gear", ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO", "PATIENT"]],
  ["book", "Book a visit", "ph-calendar-plus", ["PATIENT"]],
  ["mine", "My appointments", "ph-calendar-check", ["PATIENT"]],
];

const ROLES = {
  ORG_ADMIN: "Organization admin",
  BRANCH_ADMIN: "Branch admin",
  STAFF: "Reception",
  PHYSIO: "Physiotherapist",
  PATIENT: "Patient",
};

const $ = (sel) => document.querySelector(sel);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function inr(paise) {
  const n = Number(paise) || 0;
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}₹${Math.floor(abs / 100).toLocaleString("en-IN")}.${String(abs % 100).padStart(2, "0")}`;
}

function when(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts;
}

function chip(status) {
  const map = {
    BOOKED: ["is-booked", "Booked"],
    CHECKED_IN: ["is-waiting", "Checked in"],
    WAITING: ["is-waiting", "Waiting"],
    IN_SERVICE: ["is-service", "In service"],
    COMPLETED: ["is-done", "Completed"],
    DONE: ["is-done", "Done"],
    CANCELLED: ["is-bad", "Cancelled"],
    NO_SHOW: ["is-bad", "No-show"],
    AVAILABLE: ["is-done", "Available"],
    ON_BREAK: ["is-waiting", "On break"],
    OFF_DUTY: ["is-muted", "Off duty"],
    UNAVAILABLE: ["is-bad", "Unavailable"],
    POSTED: ["is-waiting", "Posted"],
    PAID: ["is-done", "Paid"],
    CREDITED: ["is-muted", "Credited"],
    FAILED: ["is-bad", "Failed"],
    SENT: ["is-done", "Sent"],
    EMPLOYEE: ["is-service", "Employee"],
    CONSULTANT: ["is-booked", "Consultant"],
  };
  const [cls, label] = map[status] || ["is-muted", status || "Unknown"];
  return `<span class="hw-chip ${cls}">${esc(label)}</span>`;
}

function toast(message) {
  const node = $("#toast");
  node.hidden = false;
  node.textContent = message;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { node.hidden = true; }, 3200);
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    state.offline = true;
    $("#online-badge").className = "hw-chip is-bad";
    $("#online-badge").textContent = "Offline";
    throw new Error("The clinic API is unreachable. Booking, billing and chart edits stay blocked.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || "Request failed");
    error.fieldErrors = data.error?.fieldErrors || [];
    throw error;
  }
  state.offline = false;
  if ($("#online-badge")) {
    $("#online-badge").className = "hw-chip is-done";
    $("#online-badge").textContent = "Online";
  }
  return data;
}

function branchQuery() {
  return state.user?.role === "PATIENT" ? "" : `branchId=${encodeURIComponent(state.branchId)}`;
}

function openModal(title, body, bind) {
  $("#modal-root").innerHTML = `<div class="hw-modal-back" id="modal-back"><div class="hw-modal" role="dialog" aria-modal="true"><div class="hw-head"><h2 class="dash-title">${esc(title)}</h2><button class="hw-btn hw-btn-ghost" type="button" data-close>Close</button></div><div id="modal-body">${body}</div></div></div>`;
  const close = () => { $("#modal-root").innerHTML = ""; };
  $("#modal-root").querySelector("[data-close]").onclick = close;
  $("#modal-back").addEventListener("click", (event) => { if (event.target.id === "modal-back") close(); });
  bindCombos($("#modal-body"));
  bind?.($("#modal-body"), close);
}

function combo(name, options, selected = "") {
  const list = options.length ? options : [{ value: "", label: "Nothing to choose" }];
  const current = list.find((item) => item.value === selected) || list[0];
  return `<div class="hw-combo" data-combo data-name="${esc(name)}"><input class="hw-input hw-combo-input" type="text" placeholder="Type to search" autocomplete="off" value="${esc(current.label)}" /><input type="hidden" name="${esc(name)}" value="${esc(current.value)}" /><div class="hw-combo-list" hidden>${list.map((item) => `<button type="button" class="hw-combo-option" data-value="${esc(item.value)}">${esc(item.label)}</button>`).join("")}</div></div>`;
}

function refillCombo(wrap, options, selected = "") {
  if (!wrap) return;
  const list = options.length ? options : [{ value: "", label: "Nothing to choose" }];
  const current = list.find((item) => String(item.value) === String(selected)) || list[0];
  wrap.querySelector("input[type=hidden]").value = current.value;
  wrap.querySelector(".hw-combo-input").value = current.label;
  wrap.querySelector(".hw-combo-list").innerHTML = list.map((item) => `<button type="button" class="hw-combo-option" data-value="${esc(item.value)}">${esc(item.label)}</button>`).join("");
}

function bindCombos(root) {
  if (!document.documentElement.dataset.comboOutside) {
    document.documentElement.dataset.comboOutside = "1";
    document.addEventListener("pointerdown", (event) => {
      document.querySelectorAll("[data-combo]").forEach((wrap) => {
        if (wrap.contains(event.target)) return;
        const list = wrap.querySelector(".hw-combo-list");
        const input = wrap.querySelector(".hw-combo-input");
        if (!list || list.hidden) return;
        list.hidden = true;
        if (input?.dataset.saved != null) {
          input.value = input.dataset.saved;
          delete input.dataset.saved;
        }
      });
    });
  }
  root.querySelectorAll("[data-combo]").forEach((wrap) => {
    if (wrap.dataset.bound) return;
    wrap.dataset.bound = "1";
    const input = wrap.querySelector(".hw-combo-input");
    const hidden = wrap.querySelector("input[type=hidden]");
    const list = wrap.querySelector(".hw-combo-list");
    const showAll = () => {
      list.querySelectorAll(".hw-combo-option").forEach((button) => { button.hidden = false; });
      list.hidden = false;
    };
    const open = () => {
      if (!list.hidden) return showAll();
      input.dataset.saved = input.value;
      input.value = "";
      showAll();
    };
    input.addEventListener("focus", open);
    input.addEventListener("click", open);
    input.addEventListener("input", () => { list.hidden = false; const query = input.value.trim().toLowerCase(); list.querySelectorAll(".hw-combo-option").forEach((button) => { button.hidden = Boolean(query) && !button.textContent.toLowerCase().includes(query); }); });
    list.addEventListener("pointerdown", (event) => {
      const button = event.target.closest(".hw-combo-option");
      if (!button) return;
      event.preventDefault();
      hidden.value = button.dataset.value;
      input.value = button.textContent.trim();
      delete input.dataset.saved;
      list.hidden = true;
      wrap.dispatchEvent(new Event("change", { bubbles: true }));
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (document.activeElement === input) return;
        list.hidden = true;
        if (input.dataset.saved != null) {
          input.value = input.dataset.saved;
          delete input.dataset.saved;
        }
      }, 0);
    });
  });
}

function initials(name) {
  return String(name || "").split(/\s+/).filter((part) => part && !/^dr\.?$/i.test(part)).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "HW";
}

function weekDates(offset = 0) {
  const [year, month, day] = todayKey().split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day));
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" }).format(date);
    return { key, label, today: key === todayKey() };
  });
}

function slotIso(dateKey, hour, minute) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 60 * 60 * 1000).toISOString();
}

function mondayKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function weekOffsetFor(dateKey) {
  const current = new Date(`${mondayKey(todayKey())}T00:00:00Z`).getTime();
  const picked = new Date(`${mondayKey(dateKey)}T00:00:00Z`).getTime();
  return Math.round((picked - current) / (7 * 86400000));
}

function rangeLabel(days) {
  const start = dayStamp(slotIso(days[0].key, 12, 0)).replace(/,?\s*\d{4}$/, "");
  const end = dayStamp(slotIso(days[6].key, 12, 0));
  return `${start} – ${end}`;
}

function monthTitle(year, month) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthCells(year, month, selectedKeys) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = todayKey();
  const selected = new Set(selectedKeys);
  let cells = "";
  for (let index = 0; index < pad; index += 1) cells += `<span class="hw-day is-empty"></span>`;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const tone = [key === today ? "is-today" : "", selected.has(key) ? "is-on" : ""].filter(Boolean).join(" ");
    cells += `<button type="button" class="hw-day ${tone}" data-date="${key}">${day}</button>`;
  }
  return cells;
}

function datePicker(days) {
  const [year, month] = days[0].key.split("-").map(Number);
  return `<div class="hw-datepick">
    <button type="button" class="hw-datepick-btn" data-open-date aria-expanded="false" aria-label="Choose a date">
      <i class="ph ph-calendar-blank"></i><span>${esc(rangeLabel(days))}</span>
    </button>
    <div class="hw-datepop" hidden data-year="${year}" data-month="${month}">
      <div class="hw-datepop-head">
        <button type="button" data-shift="-1" aria-label="Previous month">‹</button>
        <strong data-month-label>${esc(monthTitle(year, month))}</strong>
        <button type="button" data-shift="1" aria-label="Next month">›</button>
      </div>
      <div class="hw-datepop-week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      <div class="hw-datepop-grid" data-grid>${monthCells(year, month, days.map((day) => day.key))}</div>
    </div>
  </div>`;
}

function weekToolbar(days) {
  return `<div class="hw-weeknav"><button class="hw-btn" id="week-prev" type="button" aria-label="Previous week">‹</button>${datePicker(days)}<button class="hw-btn" id="week-next" type="button" aria-label="Next week">›</button></div><button class="hw-btn" id="week-today" type="button">Today</button>`;
}

function bindDatePicker(root, onPick) {
  const pop = root.querySelector(".hw-datepop");
  const open = root.querySelector("[data-open-date]");
  if (!pop || !open) return;
  const selected = [...pop.querySelectorAll(".hw-day.is-on")].map((button) => button.dataset.date);
  const paint = () => {
    const year = Number(pop.dataset.year);
    const month = Number(pop.dataset.month);
    pop.querySelector("[data-month-label]").textContent = monthTitle(year, month);
    pop.querySelector("[data-grid]").innerHTML = monthCells(year, month, selected);
  };
  open.onclick = (event) => {
    event.stopPropagation();
    const show = pop.hidden;
    pop.hidden = !show;
    open.setAttribute("aria-expanded", String(show));
  };
  pop.addEventListener("click", (event) => {
    event.stopPropagation();
    const shift = event.target.closest("[data-shift]");
    if (shift) {
      let year = Number(pop.dataset.year);
      let month = Number(pop.dataset.month) + Number(shift.dataset.shift);
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      pop.dataset.year = String(year);
      pop.dataset.month = String(month);
      paint();
      return;
    }
    const day = event.target.closest("[data-date]");
    if (day) onPick(day.dataset.date);
  });
  if (state.datePickClose) document.removeEventListener("click", state.datePickClose);
  state.datePickClose = (event) => {
    document.querySelectorAll(".hw-datepop").forEach((panel) => {
      const wrap = panel.closest(".hw-datepick");
      if (wrap && !wrap.contains(event.target)) {
        panel.hidden = true;
        wrap.querySelector("[data-open-date]")?.setAttribute("aria-expanded", "false");
      }
    });
  };
  document.addEventListener("click", state.datePickClose);
}

function formError(error) {
  const fields = (error.fieldErrors || []).map((item) => item.message).join(" ");
  return fields || error.message;
}

function go(name) {
  location.hash = `#/${name}`;
}

function currentRoute() {
  const [name, id] = (location.hash.replace(/^#\/?/, "") || "today").split("/");
  return { name: name || "today", id: id || "" };
}

function renderNav() {
  const role = state.user.role;
  $("#sidenav").innerHTML = NAV.filter((item) => item[3].includes(role)).map(([id, label, icon]) => `
    <a href="#/${id}" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl" data-nav="${id}">
      <i class="ph ${icon} text-xl"></i><span class="nav-text font-medium">${label}</span>
    </a>`).join("");
  const route = currentRoute().name === "patient" ? "patients" : currentRoute().name;
  document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("is-active", link.dataset.nav === route));
}

function setShell() {
  $("#login-screen").hidden = true;
  $("#app").hidden = false;
  $("#who-name").textContent = state.user.name;
  $("#who-role").textContent = ROLES[state.user.role] || state.user.role;
  const viewing = $("#viewing-as");
  const branchSlot = $("#branch-slot");
  if (state.user.role === "PATIENT") {
    viewing.hidden = false;
    viewing.textContent = `Viewing as ${state.user.name} · ${state.user.patientCode}`;
    if (branchSlot) branchSlot.style.display = "none";
  } else {
    viewing.hidden = true;
    if (branchSlot) branchSlot.style.display = "";
  }
  renderNav();
}

async function loadBranches() {
  if (state.user.role === "PATIENT") return;
  const data = await api(`/bootstrap?${branchQuery()}`);
  state.bootstrap = data;
  const slot = $("#branch-slot");
  if (!state.branchId || !data.branches.some((branch) => branch.id === state.branchId)) state.branchId = data.branches[0].id;
  slot.innerHTML = combo("branchId", data.branches.map((branch) => ({ value: branch.id, label: branch.name })), state.branchId);
  bindCombos(slot);
  slot.querySelector("[data-combo]").addEventListener("change", () => {
    state.branchId = slot.querySelector("input[type=hidden]").value;
    sessionStorage.setItem("hw-branch", state.branchId);
    render();
  });
}

async function render() {
  const route = currentRoute();
  if (state.user.role === "PATIENT" && !["book", "mine", "settings"].includes(route.name)) {
    location.hash = "#/book";
    return;
  }
  renderNav();
  const view = $("#view");
  view.innerHTML = `<p class="hw-muted">Loading…</p>`;
  try {
    const page = pages[route.name] || pages.today;
    const html = await page(route);
    if (currentRoute().name !== route.name || currentRoute().id !== route.id) return;
    view.innerHTML = html.markup;
    bindCombos(view);
    html.bind?.(view);
    const banner = $("#stale-banner");
    banner.hidden = !state.offline;
  } catch (error) {
    if (state.offline && route.name === "today") {
      const cached = sessionStorage.getItem("hw-board");
      if (cached) {
        view.innerHTML = cached;
        $("#stale-banner").hidden = false;
        $("#stale-banner").textContent = "Stale cached day board. Appointments, visits, billing and patient edits need a live connection.";
        return;
      }
    }
    view.innerHTML = `<div class="dash-panel pad"><p>${esc(error.message)}</p><button class="hw-btn hw-btn-primary" id="retry" type="button" style="margin-top:12px">Retry</button></div>`;
    $("#retry").onclick = () => render();
  }
}

const pages = {
  async today() {
    let data;
    try {
      data = await api(`/dashboard?${branchQuery()}`);
    } catch (error) {
      state.offline = true;
      throw error;
    }
    const markup = `
      <div class="hw-page">
        <div class="hw-head"><div><h1 class="hw-title">${esc(data.branch.name)} today</h1><p class="hw-sub">Updated ${esc(when(data.generatedAt))} IST</p></div></div>
        <div class="hw-kpis">
          ${kpi("Appointments", data.kpis.appointmentsToday, "dash-kpi-green")}
          ${kpi("Waiting", data.kpis.waiting, "dash-kpi-amber")}
          ${kpi("In service", data.kpis.inService, "dash-kpi-green")}
          ${kpi("Unbilled", data.kpis.unbilled, "dash-kpi-amber")}
          ${kpi("Dues", inr(data.kpis.duesPaise), "dash-kpi-red")}
        </div>
        <div class="hw-split">
          <section class="dash-panel">
            <div class="pad" style="border-bottom:1px solid var(--color-border-subtle)"><h2 class="dash-title">Day board</h2></div>
            <div class="hw-table-wrap"><table class="hw-table"><thead><tr><th>Time</th><th>Patient</th><th>Physiotherapist</th><th>Service</th><th>Status</th><th></th></tr></thead><tbody>
              ${data.upcoming.concat(data.physios.flatMap((p) => p.queue.filter((row) => row.status === "IN_SERVICE"))).filter((row, index, list) => list.findIndex((item) => item.id === row.id) === index).sort((a, b) => a.start.localeCompare(b.start)).map(appointmentRow).join("") || `<tr><td colspan="6">No appointments on the board.</td></tr>`}
            </tbody></table></div>
          </section>
          <aside class="dash-panel pad">
            <h2 class="dash-title">Live availability</h2>
            <div style="margin-top:8px">${data.alerts.map((alert) => `<div class="hw-alert ${esc(alert.tone)}">${esc(alert.text)}</div>`).join("") || `<p class="hw-muted">No operational alerts.</p>`}</div>
            ${data.physios.map((physio) => `<div class="hw-person"><div><strong>${esc(physio.name)}</strong><div class="hw-muted">${esc(physio.specialty)} · ${esc(physio.engagement)}</div></div><div>${chip(physio.liveStatus)}</div></div>`).join("")}
          </aside>
        </div>
      </div>`;
    sessionStorage.setItem("hw-board", markup);
    return { markup, bind: bindAppointmentActions };
  },
  async patients() {
    const q = $("#global-search")?.value || "";
    const data = await api(`/patients?q=${encodeURIComponent(q)}&${branchQuery()}`);
    const shared = q.replace(/\D/g, "").length >= 4 && data.patients.length > 1;
    return {
      markup: `
        <div class="hw-page">
          <div class="hw-head"><div><h1 class="hw-title">Patients</h1><p class="hw-sub">Phone numbers are masked. A shared family number opens a picker and never merges records.</p></div>
            ${canRegister() ? `<button class="hw-btn hw-btn-primary" id="new-patient" type="button">New patient</button>` : ""}</div>
          ${shared ? `<div class="hw-banner">Several profiles share this number. Choose the right person before continuing.</div>` : ""}
          <section class="dash-panel hw-table-wrap"><table class="hw-table"><thead><tr><th>Patient</th><th>Phone</th><th>Branch</th><th>Flags</th><th>Dues</th></tr></thead><tbody>
            ${data.patients.map((patient) => `<tr><td><a class="hw-link" href="#/patient/${patient.id}">${esc(patient.name)}</a><div class="hw-muted">${esc(patient.code)}</div></td><td>${esc(patient.phoneMasked)}</td><td>${esc(patient.branchName)}</td><td>${patient.flags.map((flag) => `<span class="hw-chip ${flag === "Dues" ? "is-waiting" : flag === "Minor" ? "is-bad" : "is-booked"}">${esc(flag)}</span>`).join(" ") || "—"}</td><td>${inr(patient.duesPaise)}</td></tr>`).join("") || `<tr><td colspan="5">No matching patients.</td></tr>`}
          </tbody></table></section>
        </div>`,
      bind: (root) => { root.querySelector("#new-patient")?.addEventListener("click", patientForm); },
    };
  },
  async patient(route) {
    const data = await api(`/patients/${route.id}`);
    return patientChart(data);
  },
  async calendar() {
    const data = await api(`/appointments?${branchQuery()}`);
    const board = appointmentBoard("calendar", data.appointments, {
      title: "Appointments",
      subtitle: "Every booking is listed here, including next week. Cancel a patient visit from the card or the week board.",
      icon: "ph-calendar-blank",
      defaultFilter: "all",
    });
    const week = await weekBoard(data.appointments);
    return {
      markup: board.markup.replace("</div><!--hw-page-->", `${week.markup}</div>`),
      bind: (root) => { board.bind(root); week.bind(root); },
    };
  },
  async queue() {
    const data = await api(`/appointments?${branchQuery()}`);
    return appointmentBoard("queue", data.appointments, {
      title: "Queue",
      subtitle: "Walk-ins and checked-in visits waiting for a physiotherapist.",
      icon: "ph-queue",
      defaultFilter: "queue",
      walkIn: true,
    });
  },
  async physios() {
    const data = await api(`/bootstrap?${branchQuery()}`);
    const roster = data.physios.filter((physio) => physio.branchId === state.branchId);
    const query = (state.physioQuery || "").toLowerCase();
    const visible = roster.filter((physio) => !query || `${physio.name} ${physio.specialty}`.toLowerCase().includes(query));
    return {
      markup: `<div class="hw-page"><div class="hw-head"><div class="hw-row"><span class="dash-icon-chip"><i class="ph ph-stethoscope"></i></span><div><h1 class="hw-title">Physiotherapists</h1><p class="hw-sub">Directory for this branch. New physiotherapists appear here and on the live rail.</p></div></div>${canManage() ? `<button class="hw-btn hw-btn-primary" id="add-physio" type="button"><i class="ph ph-plus"></i> Add physiotherapist</button>` : ""}</div>
        <div class="hw-split"><section><div class="hw-row" style="margin-bottom:12px"><input class="hw-input" id="physio-search" placeholder="Search physiotherapists" value="${esc(state.physioQuery || "")}" style="max-width:280px"></div><div class="hw-directory">${visible.map(physioCard).join("") || `<div class="pad">No physiotherapists yet.</div>`}</div></section>
        <aside class="dash-panel pad"><h2 class="dash-title">Live board</h2><p class="hw-sub">Status returns to break or available when the visit ends.</p>${roster.map((physio) => `<div class="hw-person"><div><strong>${esc(physio.name)}</strong><div class="hw-muted">${esc(physio.specialty)}</div></div><div class="hw-stack">${chip(physio.liveStatus)}${canChangeStatus(physio) ? `<div class="hw-row">${["AVAILABLE", "ON_BREAK", "OFF_DUTY", "UNAVAILABLE"].map((status) => `<button class="hw-btn" data-status="${status}" data-physio="${physio.id}" type="button">${esc(status.replaceAll("_", " "))}</button>`).join("")}</div>` : ""}</div></div>`).join("")}</aside></div></div>`,
      bind: (root) => {
        root.querySelector("#add-physio")?.addEventListener("click", () => clinicianForm("PHYSIO"));
        root.querySelector("#physio-search").addEventListener("change", (event) => { state.physioQuery = event.target.value; render(); });
        root.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", async () => {
          await api(`/physios/${button.dataset.physio}/status`, { method: "POST", body: { status: button.dataset.status } });
          toast("Status updated. Future bookings were reassigned or cancelled where needed.");
          render();
        }));
      },
    };
  },
  async billing() {
    const data = await api(`/invoices?${branchQuery()}`);
    return {
        markup: pageHead("Billing", "Money is stored in paise. Posted invoices stay unchanged; corrections use a credit note.", `<button class="hw-btn hw-btn-primary" id="new-invoice" type="button">New invoice</button>`) +
        table(["Invoice", "Patient", "Transaction ID", "Total", "Due", "Status", ""], data.invoices.map((invoice) => `<tr><td>${esc(invoice.number)}</td><td>${esc(invoice.patientName)}<div class="hw-muted">${esc(invoice.patientCode)}</div></td><td>${esc(invoice.transactionId || "—")}</td><td>${inr(invoice.totalPaise)}</td><td>${inr(invoice.duePaise)}</td><td>${chip(invoice.status)}</td><td class="hw-row">${invoice.status !== "CREDITED" ? `<button class="hw-btn" data-txn="${invoice.id}" data-ref="${esc(invoice.transactionId || "")}" type="button">Transaction ID</button>` : ""}${invoice.duePaise > 0 ? `<button class="hw-btn" data-pay="${invoice.id}" data-due="${invoice.duePaise}" type="button">Take payment</button>` : ""}${state.user.role === "ORG_ADMIN" && invoice.status !== "CREDITED" ? `<button class="hw-btn" data-credit="${invoice.id}" type="button">Credit note</button>` : ""}</td></tr>`), "No invoices yet."),
      bind: (root) => {
        root.querySelector("#new-invoice").onclick = () => invoiceForm();
        root.querySelectorAll("[data-txn]").forEach((button) => button.onclick = () => transactionForm(button.dataset.txn, button.dataset.ref));
        root.querySelectorAll("[data-pay]").forEach((button) => button.onclick = () => paymentForm(button.dataset.pay, Number(button.dataset.due)));
        root.querySelectorAll("[data-credit]").forEach((button) => button.onclick = () => creditForm(button.dataset.credit));
      },
    };
  },
  async packages() {
    const data = await api(`/packages?${branchQuery()}`);
    return {
      markup: pageHead("Packages", "Credits are consumed when a completed visit uses a package.", `<button class="hw-btn hw-btn-primary" id="sell-pack" type="button">Sell package</button>`) +
        `<div class="hw-split"><section class="dash-panel pad"><h2 class="dash-title">Catalog</h2>${data.catalog.map((pkg) => `<div class="hw-person"><div><strong>${esc(pkg.name)}</strong><div class="hw-muted">${pkg.credits} credits</div></div><div>${inr(pkg.pricePaise)}</div></div>`).join("")}</section>
        <section class="dash-panel hw-table-wrap"><table class="hw-table"><thead><tr><th>Patient</th><th>Package</th><th>Left</th><th></th></tr></thead><tbody>${data.purchases.map((row) => `<tr><td>${esc(row.patientName)}</td><td>${esc(row.packageName)}${row.frozen ? " · frozen" : ""}</td><td>${row.creditsLeft}/${row.creditsTotal}</td><td><button class="hw-btn" data-freeze="${row.id}" data-frozen="${row.frozen ? "0" : "1"}" type="button">${row.frozen ? "Unfreeze" : "Freeze"}</button></td></tr>`).join("") || `<tr><td colspan="4">No purchases at this branch.</td></tr>`}</tbody></table></section></div>`,
      bind: (root) => {
        root.querySelector("#sell-pack").onclick = () => packageForm(data.catalog);
        root.querySelectorAll("[data-freeze]").forEach((button) => button.onclick = async () => {
          await api(`/packages/${button.dataset.freeze}/freeze`, { method: "POST", body: { frozen: button.dataset.frozen === "1" } });
          render();
        });
      },
    };
  },
  async team() {
    const data = await api(`/staff?${branchQuery()}`);
    return {
      markup: `<div class="hw-page"><div class="hw-head"><div class="hw-row"><span class="dash-icon-chip"><i class="ph ph-users-three"></i></span><div><h1 class="hw-title">Team</h1><p class="hw-sub">Reception, branch managers and physiotherapists for this branch.</p></div></div><button class="hw-btn hw-btn-primary" id="add-employee" type="button"><i class="ph ph-plus"></i> Add employee</button></div>
        <div class="hw-directory">${data.people.filter((person) => person.role !== "ORG_ADMIN").map((person) => `<article class="bg-w1 p-5"><div class="hw-row" style="justify-content:space-between"><span class="hw-chip is-booked">${esc(ROLES[person.role] || person.role)}</span>${person.engagement ? chip(person.engagement) : ""}</div><div style="display:grid;place-items:center;margin:14px 0"><div class="hw-avatar">${esc(initials(person.name))}</div><strong style="margin-top:8px">${esc(person.name)}</strong><span class="hw-muted">${esc(person.specialty || person.email)}</span></div><p class="hw-muted">${esc(person.email)}</p></article>`).join("")}</div></div>`,
      bind: (root) => { root.querySelector("#add-employee").onclick = () => clinicianForm("STAFF"); },
    };
  },
  async reports() {
    const scope = state.reportScope || state.branchId;
    const data = await api(`/reports?branchId=${encodeURIComponent(scope)}`);
    return {
      markup: pageHead("Reports", `Month ${esc(data.month)}. Sessions split by employee and consultant.`, state.user.role === "ORG_ADMIN" ? `<button class="hw-btn" id="compare" type="button">All branches</button>` : "") +
        data.branches.map((branch) => `<section class="dash-panel pad"><div class="hw-head"><h2 class="dash-title">${esc(branch.branchName)}</h2><span class="hw-muted">${inr(branch.duesPaise)} dues</span></div><div class="hw-kpis" style="margin-top:10px">${kpi("Consultations", branch.consultationsMtd, "dash-kpi-green")}${kpi("Employee", branch.employeeSessions, "dash-kpi-green")}${kpi("Consultant", branch.consultantSessions, "dash-kpi-amber")}</div>${branch.physios.map((physio) => `<div class="hw-person"><span>${esc(physio.name)} ${chip(physio.engagement)}</span><span>${physio.sessions} sessions · rating ${physio.rating ?? "—"}</span></div>`).join("")}</section>`).join(""),
      bind: (root) => { root.querySelector("#compare")?.addEventListener("click", () => { state.reportScope = "all"; render(); }); },
    };
  },
  async notifications() {
    const data = await api(`/notifications?${branchQuery()}`);
    return {
      markup: pageHead("Notifications", "Reminders omit diagnosis and clinical detail. Failed messages can be retried.") +
        table(["When", "Patient", "Channel", "Template", "Status", ""], data.notifications.map((note) => `<tr><td>${esc(when(note.at))}</td><td>${esc(note.patientName)}<div class="hw-muted">${esc(note.patientCode)}</div></td><td>${esc(note.channel)}</td><td>${esc(note.template)}</td><td>${chip(note.status)}<div class="hw-muted">${esc(note.lastError || "")}</div></td><td>${note.status === "FAILED" ? `<button class="hw-btn" data-retry="${note.id}" type="button">Retry</button>` : ""}</td></tr>`), "No messages."),
      bind: (root) => root.querySelectorAll("[data-retry]").forEach((button) => button.onclick = async () => { await api(`/notifications/${button.dataset.retry}/retry`, { method: "POST", body: {} }); toast("Retry recorded."); render(); }),
    };
  },
  async audit() {
    const data = await api(`/audit?${branchQuery()}`);
    return { markup: pageHead("Audit", "Sensitive reads, phone reveals, billing and exports are recorded.") + table(["When", "Who", "Action", "Target", "Outcome"], data.events.map((event) => `<tr><td>${esc(when(event.at))}</td><td>${esc(event.actorName)}</td><td>${esc(event.action)}</td><td>${esc(event.targetType)} ${esc(event.targetId)}</td><td>${esc(event.outcome)}</td></tr>`), "No audit events yet.") };
  },
  async settings() {
    const tab = state.settingsTab || "clinic";
    const [flags, sessions] = await Promise.all([api("/flags"), api("/auth/sessions")]);
    const catalog = canManage() ? await api("/catalog") : { services: [], packages: [] };
    const directory = tab === "branches" || tab === "booking" ? await api("/branches") : null;
    const schedules = tab === "hours" && canEditHours() ? await api("/consult-schedules") : null;
    const tabs = `<div class="hw-tabs"><button class="hw-btn ${tab === "clinic" ? "is-on" : ""}" data-tab="clinic" type="button">Clinic</button>${canEditHours() ? `<button class="hw-btn ${tab === "hours" ? "is-on" : ""}" data-tab="hours" type="button">Hours</button>` : ""}${canManage() ? `<button class="hw-btn ${tab === "booking" ? "is-on" : ""}" data-tab="booking" type="button">Booking</button><button class="hw-btn ${tab === "branches" ? "is-on" : ""}" data-tab="branches" type="button">Branches</button><button class="hw-btn ${tab === "services" ? "is-on" : ""}" data-tab="services" type="button">Services</button><button class="hw-btn ${tab === "packages" ? "is-on" : ""}" data-tab="packages" type="button">Packages</button>` : ""}</div>`;
    let body = "";
    if (tab === "services") {
      body = `<div class="hw-head"><h2 class="dash-title">Services</h2><button class="hw-btn hw-btn-primary" id="add-service" type="button">Add service</button></div>` + table(["Service", "Type", "Slots", "Status", ""], catalog.services.map((service) => `<tr><td>${esc(service.name)}</td><td>${service.kind === "CONSULT" ? "Consultation" : "Therapy"}</td><td>${service.kind === "CONSULT" ? `${service.durationMin} min · 1 slot` : `${service.durationMin} min × up to ${service.maxSlots || 1} slots`}</td><td>${service.active === false ? "Inactive" : "Active"}</td><td>${state.user.role === "ORG_ADMIN" ? `<button class="hw-btn" data-edit-service="${service.id}" type="button">Edit</button>` : ""}</td></tr>`), "No services yet.");
    } else if (tab === "booking") {
      const orgAdmin = state.user.role === "ORG_ADMIN";
      body = `<div class="hw-head"><div><h2 class="dash-title">Booking rules</h2><p class="hw-sub">Consultations stay one at a time. Therapy sessions can overlap up to the capacity set here, then on a branch, then on a physiotherapist.</p></div></div>
        <div class="hw-split">
          <section class="dash-panel pad"><h2 class="dash-title">Default parallel therapy</h2>
            <form id="org-capacity" class="hw-stack">
              <div class="hw-field"><label class="hw-label">Organization default</label><input class="hw-input" name="parallelTherapyCapacity" type="number" min="1" max="20" value="${catalog.booking?.parallelTherapyCapacity || 1}" ${orgAdmin ? "" : "disabled"}></div>
              ${orgAdmin ? `<button class="hw-btn hw-btn-primary" type="submit">Save default</button>` : `<p class="hw-muted">Only the organization admin changes the default.</p>`}
            </form>
            <div class="hw-stack" style="margin-top:16px">${directory.branches.map((branch) => `<form class="hw-row" data-branch-capacity="${branch.id}"><span style="flex:1">${esc(branch.name)}</span><input class="hw-input" name="parallelTherapyCapacity" type="number" min="1" max="20" placeholder="Inherit" value="${branch.parallelTherapyCapacity || ""}" style="max-width:120px"><button class="hw-btn" type="submit">Save</button></form>`).join("")}</div>
          </section>
          <section class="dash-panel pad"><h2 class="dash-title">Payment methods</h2>
            ${(catalog.paymentMethods || []).map((method) => `<div class="hw-person"><div><strong>${esc(method.name)}</strong><div class="hw-muted">${esc(method.code)}</div></div>${orgAdmin ? `<button class="hw-btn" data-method="${method.id}" data-active="${method.active === false ? "1" : "0"}" type="button">${method.active === false ? "Activate" : "Deactivate"}</button>` : ""}</div>`).join("")}
            ${orgAdmin ? `<form id="add-method" class="hw-row" style="margin-top:12px"><input class="hw-input" name="name" placeholder="Name"><input class="hw-input" name="code" placeholder="CODE"><button class="hw-btn hw-btn-primary" type="submit">Add</button></form>` : ""}
            <h2 class="dash-title" style="margin-top:18px">Categories</h2>
            ${(catalog.categories || []).map((category) => `<div class="hw-person"><div><strong>${esc(category.name)}</strong><div class="hw-muted">${esc(category.kind)} · ${category.active === false ? "Inactive" : "Active"}</div></div>${orgAdmin ? `<button class="hw-btn" data-category="${category.id}" data-active="${category.active === false ? "1" : "0"}" type="button">${category.active === false ? "Activate" : "Deactivate"}</button>` : ""}</div>`).join("")}
            ${orgAdmin ? `<form id="add-category" class="hw-row" style="margin-top:12px"><input class="hw-input" name="name" placeholder="Category"><button class="hw-btn hw-btn-primary" type="submit">Add therapy category</button></form>` : ""}
          </section>
        </div>`;
    } else if (tab === "branches") {
      const canCreate = state.user.role === "ORG_ADMIN";
      body = `<div class="hw-head"><div><h2 class="dash-title">Branches</h2><p class="hw-sub">${canCreate ? "You can open every branch. Assign a branch admin and they will only see those branches." : "You can open only the branches assigned to you."}</p></div>${canCreate ? `<button class="hw-btn hw-btn-primary" id="add-branch" type="button"><i class="ph ph-plus"></i> Add branch</button>` : ""}</div>
        <div class="hw-directory">${directory.branches.map((branch) => `<article class="bg-w1 p-5"><div class="hw-row" style="justify-content:space-between"><span class="hw-chip is-booked">${esc(branch.code)}</span><span class="hw-muted">${esc(branch.hours)}</span></div><strong style="display:block;margin-top:12px">${esc(branch.name)}</strong><p class="hw-muted">${esc(branch.city)}</p><p class="hw-muted" style="margin-top:8px">Branch admin: ${branch.admins.length ? branch.admins.map((admin) => esc(admin.name)).join(", ") : "Not assigned"}</p>${canCreate ? `<button class="hw-btn" data-assign="${branch.id}" type="button" style="margin-top:12px">Assign branch admin</button>` : ""}</article>`).join("")}</div>`;
    } else if (tab === "packages") {
      body = `<div class="hw-head"><h2 class="dash-title">Packages</h2><button class="hw-btn hw-btn-primary" id="add-package" type="button">Add package</button></div>` + table(["Package", "Credits", "Prices"], catalog.packages.map((pkg) => `<tr><td>${esc(pkg.name)}</td><td>${pkg.credits}</td><td>${pkg.prices.map((price) => `${esc(price.branchName)} ${price.pricePaise == null ? "—" : inr(price.pricePaise)}`).join(" · ")}</td></tr>`), "No packages yet.");
    } else if (tab === "hours" && schedules) {
      body = `<div class="hw-head"><div><h2 class="dash-title">Consultation hours</h2><p class="hw-sub">These hours and leave dates appear on the patient calendar and the clinic week board. A physiotherapist can edit only their own schedule.</p></div></div>${hoursEditor(schedules)}`;
    } else {
      body = `<div class="hw-split"><section class="dash-panel pad"><h2 class="dash-title">Feature flags</h2>
          <label class="hw-check" style="margin-top:12px"><input id="flag-booking" type="checkbox" ${flags.patientBooking ? "checked" : ""} ${state.user.role === "ORG_ADMIN" ? "" : "disabled"}> Patient self-booking</label>
          <label class="hw-check" style="margin-top:8px"><input id="flag-ratings" type="checkbox" ${flags.publicRatings ? "checked" : ""} ${state.user.role === "ORG_ADMIN" ? "" : "disabled"}> Public ratings</label>
          ${state.user.role === "ORG_ADMIN" ? `<button class="hw-btn hw-btn-primary" id="save-flags" type="button" style="margin-top:12px">Save flags</button>` : ""}</section>
          <section class="dash-panel pad"><h2 class="dash-title">Sessions</h2>${sessions.sessions.map((session) => `<div class="hw-person"><span>${esc(when(session.createdAt))}${session.current ? " · this device" : ""}</span><button class="hw-btn" data-revoke="${session.id}" type="button">Revoke</button></div>`).join("")}</section></div>`;
    }
    return {
      markup: pageHead("Settings", "Consultation hours, branches, services and packages are maintained here. Flags still apply on the server.", tabs) + body,
      bind: (root) => {
        root.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => { state.settingsTab = button.dataset.tab; render(); });
        root.querySelector("#save-flags")?.addEventListener("click", async () => {
          await api("/flags", { method: "PATCH", body: { patientBooking: root.querySelector("#flag-booking").checked, publicRatings: root.querySelector("#flag-ratings").checked } });
          toast("Flags saved.");
        });
        root.querySelectorAll("[data-revoke]").forEach((button) => button.onclick = async () => {
          await api(`/auth/sessions/${button.dataset.revoke}/revoke`, { method: "POST", body: {} });
          if (button.closest(".hw-person").textContent.includes("this device")) return logout();
          render();
        });
        root.querySelector("#add-service")?.addEventListener("click", () => catalogForm("service"));
        root.querySelectorAll("[data-edit-service]").forEach((button) => button.onclick = () => serviceEditForm(catalog.services.find((service) => service.id === button.dataset.editService)));
        root.querySelector("#add-package")?.addEventListener("click", () => catalogForm("package"));
        root.querySelector("#org-capacity")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          await api("/booking-config", { method: "PATCH", body: { parallelTherapyCapacity: Number(new FormData(event.target).get("parallelTherapyCapacity")) } });
          toast("Default capacity saved.");
          render();
        });
        root.querySelectorAll("[data-branch-capacity]").forEach((form) => form.onsubmit = async (event) => {
          event.preventDefault();
          const value = new FormData(form).get("parallelTherapyCapacity");
          await api(`/branches/${form.dataset.branchCapacity}/capacity`, { method: "PATCH", body: { parallelTherapyCapacity: value === "" ? null : Number(value) } });
          toast("Branch capacity saved.");
          render();
        });
        root.querySelector("#add-method")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          await api("/payment-methods", { method: "POST", body: { name: form.get("name"), code: form.get("code") } });
          render();
        });
        root.querySelectorAll("[data-method]").forEach((button) => button.onclick = async () => {
          await api(`/payment-methods/${button.dataset.method}`, { method: "PATCH", body: { active: button.dataset.active === "1" } });
          render();
        });
        root.querySelector("#add-category")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          await api("/categories", { method: "POST", body: { name: new FormData(event.target).get("name"), kind: "THERAPY" } });
          render();
        });
        root.querySelectorAll("[data-category]").forEach((button) => button.onclick = async () => {
          await api(`/categories/${button.dataset.category}`, { method: "PATCH", body: { active: button.dataset.active === "1" } });
          render();
        });
        root.querySelector("#add-branch")?.addEventListener("click", () => branchForm());
        root.querySelectorAll("[data-assign]").forEach((button) => button.onclick = () => assignAdminForm(button.dataset.assign, directory));
        bindHours(root);
      },
    };
  },
  async book() {
    const boot = await api("/bootstrap");
    if (!state.portalBranch || !boot.branches.some((branch) => branch.id === state.portalBranch)) {
      state.portalBranch = state.user.branchId && boot.branches.some((branch) => branch.id === state.user.branchId) ? state.user.branchId : boot.branches[0]?.id || "";
    }
    const roster = boot.physios.filter((physio) => physio.branchId === state.portalBranch);
    if (!state.portalPhysio || !roster.some((physio) => physio.id === state.portalPhysio)) state.portalPhysio = roster[0]?.id || "";
    const days = weekDates(state.portalWeek || 0);
    const from = slotIso(days[0].key, 0, 0);
    const to = slotIso(days[6].key, 23, 59);
    const board = state.portalPhysio
      ? await api(`/availability?branchId=${encodeURIComponent(state.portalBranch)}&physioId=${encodeURIComponent(state.portalPhysio)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      : { physio: null, busy: [] };
    const closed = ["OFF_DUTY", "UNAVAILABLE"].includes(board.physio?.availability);
    const hours = [];
    for (let hour = 8; hour < 20; hour += 1) for (let minute = 0; minute < 60; minute += 15) hours.push([hour, minute]);
    const cells = hours.map(([hour, minute]) => {
      const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const slots = days.map((day) => {
        const start = slotIso(day.key, hour, minute);
        const end = new Date(new Date(start).getTime() + 15 * 60000).toISOString();
        const hits = board.busy.filter((row) => row.start < end && start < row.end);
        const cap = board.physio?.parallelTherapyCapacity || 1;
        const past = new Date(start).getTime() < Date.now();
        const mine = hits.some((row) => row.mine);
        const consultBlocked = hits.some((row) => row.kind === "CONSULT" && !row.mine);
        const therapyCount = hits.filter((row) => row.kind !== "CONSULT").length;
        let kind = "open";
        if (mine) kind = "mine";
        else if (consultBlocked || therapyCount >= cap) kind = "taken";
        else if (board.physio && onLeaveDay(board.physio, day.key)) kind = "leave";
        else if (closed || !board.physio || !slotOpen(board.physio, day.key, hour, minute)) kind = "closed";
        else if (past) kind = "past";
        const tone = kind === "mine" ? "is-mine" : kind === "taken" ? "is-taken" : kind === "leave" ? "is-leave" : kind === "closed" || kind === "past" ? "is-closed" : "";
        const text = kind === "open" && therapyCount ? `Open ${therapyCount}/${cap}` : kind === "mine" ? (hits.find((row) => row.mine)?.slotCount > 1 ? `Your visit · ${hits.find((row) => row.mine).slotCount} slots` : "Your visit") : ({ taken: "Booked", leave: "Leave", open: "Open" }[kind] || "");
        const quiet = kind === "closed" || kind === "past";
        return `<button type="button" class="hw-slot ${tone}" data-start="${start}" data-kind="${kind}" ${quiet ? "disabled" : ""}>${text ? `<strong style="display:block;font-size:12px">${text}</strong>` : ""}</button>`;
      }).join("");
      return `<div class="hw-cal-time">${label}</div>${slots}`;
    }).join("");
    return {
      markup: `<div class="hw-page space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center"><i class="ph ph-calendar-blank text-primary text-lg"></i></div>
            <div><h1 class="text-lg font-semibold text-heading">Schedule</h1><p class="text-xs text-faint mt-0.5">Book more than one physiotherapist or branch. Click the dates to open the calendar.</p></div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${weekToolbar(days)}
            <button id="book-visit" class="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold inline-flex items-center gap-2" type="button"><i class="ph ph-plus text-sm"></i>Book Visit</button>
          </div>
        </div>
        <div class="dash-panel pad hw-row">
          <div class="hw-field" style="min-width:220px;margin:0"><label class="hw-label">Branch</label>${combo("portalBranch", boot.branches.map((branch) => ({ value: branch.id, label: `${branch.name} · ${branch.hours}` })), state.portalBranch)}</div>
          <div class="hw-field" style="min-width:260px;margin:0"><label class="hw-label">Physiotherapist</label>${combo("portalPhysio", roster.map((physio) => ({ value: physio.id, label: `${physio.name} · ${physio.specialty}` })), state.portalPhysio)}</div>
          <span class="hw-muted">${board.physio ? `${esc(board.physio.name)} · ${esc(hoursLabel(board.physio))}` : "No physiotherapist at this branch."}</span>
        </div>
        ${closed ? `<div class="hw-banner">This physiotherapist is not taking bookings right now.</div>` : ""}
        <section class="dash-panel hw-cal">
          <div class="hw-cal-grid">
            <div class="hw-cal-head">Time</div>
            ${days.map((day) => `<div class="hw-cal-head ${day.today ? "is-today" : ""}">${esc(day.label)}${day.today ? "<div>Today</div>" : ""}</div>`).join("")}
            ${cells}
          </div>
          <div class="pad hw-row"><span class="hw-chip is-done">Open</span><span class="hw-chip is-muted">Booked</span><span class="hw-chip is-booked">Your visit</span><span class="hw-chip is-waiting">Leave</span><span class="hw-muted">Gray times are outside consultation hours.</span></div>
        </section>
      </div>`,
      bind: (root) => {
        const remember = (name, key) => {
          root.querySelector(`[data-name=${name}]`).addEventListener("change", (event) => {
            state[key] = event.currentTarget.querySelector("input[type=hidden]").value;
            if (name === "portalBranch") state.portalPhysio = "";
            render();
          });
        };
        remember("portalBranch", "portalBranch");
        remember("portalPhysio", "portalPhysio");
        root.querySelector("#week-prev").onclick = () => { state.portalWeek = (state.portalWeek || 0) - 1; render(); };
        root.querySelector("#week-next").onclick = () => { state.portalWeek = (state.portalWeek || 0) + 1; render(); };
        root.querySelector("#week-today").onclick = () => { state.portalWeek = 0; render(); };
        bindDatePicker(root, (dateKey) => { state.portalWeek = weekOffsetFor(dateKey); render(); });
        root.querySelector("#book-visit").onclick = () => patientBookForm(boot, { branchId: state.portalBranch, physioId: state.portalPhysio });
        root.querySelectorAll(".hw-slot").forEach((slot) => slot.onclick = () => {
          if (slot.disabled) return;
          if (slot.dataset.kind === "taken") {
            openModal("Time already booked", `<p>This time is already taken with ${esc(board.physio?.name || "this physiotherapist")}. Choose an open slot so you do not wait on a clash.</p>`);
            return;
          }
          if (slot.dataset.kind === "leave") {
            openModal("On leave", `<p>${esc(board.physio?.name || "This physiotherapist")} is on leave this day. Choose another day, doctor or branch.</p>`);
            return;
          }
          if (slot.dataset.kind !== "open") return;
          patientBookForm(boot, { branchId: state.portalBranch, physioId: state.portalPhysio, start: slot.dataset.start });
        });
      },
    };
  },
  async mine() {
    const data = await api("/appointments");
    return {
      markup: pageHead("My appointments", "You can reschedule or cancel outside the two-hour window, and rate a visit once.") +
        table(["When", "Branch", "Physiotherapist", "Service", "Status", ""], data.appointments.map((row) => `<tr><td>${esc(when(row.start))}</td><td>${esc(row.branchName)}</td><td>${esc(row.physioName)}</td><td>${esc(row.serviceName)}<div class="hw-muted">${esc(lengthLabel(row))}</div></td><td>${chip(row.status)}</td><td class="hw-row">${["BOOKED", "CHECKED_IN"].includes(row.status) ? `<button class="hw-btn" data-cancel="${row.id}" type="button">Cancel</button>` : ""}${row.status === "COMPLETED" ? `<button class="hw-btn" data-rate="${row.id}" type="button">Rate</button>` : ""}</td></tr>`), "You have no appointments."),
      bind: (root) => {
        root.querySelectorAll("[data-cancel]").forEach((button) => button.onclick = () => reasonAction("Cancel appointment", "/cancel", button.dataset.cancel, ["PATIENT_REQUEST", "OTHER"]));
        root.querySelectorAll("[data-rate]").forEach((button) => button.onclick = () => feedbackForm(button.dataset.rate));
      },
    };
  },
};

function kpi(label, value, tone) {
  return `<article class="dash-panel dash-kpi ${tone}"><span class="dash-kpi-label">${esc(label)}</span><span class="dash-kpi-value">${esc(value)}</span></article>`;
}

function ageOf(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || "")) return "";
  const [year, month, day] = dob.split("-").map(Number);
  const [nowY, nowM, nowD] = todayKey().split("-").map(Number);
  let age = nowY - year;
  if (nowM < month || (nowM === month && nowD < day)) age -= 1;
  return age >= 0 ? `${age} yrs` : "";
}

function clock(iso) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

function dayStamp(iso) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function shown(value) {
  return value ? esc(value) : "—";
}

function fact(label, value) {
  return `<div class="min-w-0"><p class="text-[10px] text-faint">${label}</p><p class="text-xs font-semibold text-heading break-words">${value}</p></div>`;
}

function canEditChart() {
  return ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"].includes(state.user.role);
}

function patientChart(data) {
  const patient = data.patient;
  const tab = state.patientTab || "sessions";
  const tabs = [["sessions", "Sessions"], ["assessment", "Assessment"], ["packages", "Packages"], ["billing", "Billing"]];
  const pain = patient.painScore == null ? "—" : `${patient.painScore}/10`;
  const sessions = data.timeline.map((row) => `<tr><td>${esc(when(row.start))}</td><td>${esc(row.serviceName)}<div class="hw-muted">${esc(lengthLabel(row))}</div></td><td>${esc(row.physioName)}</td><td>${chip(row.status)}</td><td>${esc(row.note || "—")}</td></tr>`).join("");
  const packages = (data.purchases || []).map((row) => `<tr><td>${esc(row.packageName || "Package")}</td><td>${esc(row.creditsLeft)}</td><td>${chip(row.status)}</td></tr>`).join("");
  const bills = (data.invoices || []).map((row) => `<tr><td>${esc(row.number)}</td><td>${inr(row.totalPaise)}</td><td>${inr(row.duePaise)}</td><td>${esc(row.transactionId || "—")}</td><td>${chip(row.status)}</td><td>${canBill() && row.status !== "CREDITED" ? `<button class="hw-btn" data-txn="${row.id}" data-ref="${esc(row.transactionId || "")}" type="button">Transaction ID</button>` : ""}</td></tr>`).join("");
  const panels = {
    sessions: `<div class="hw-table-wrap"><table class="hw-table"><thead><tr><th>When</th><th>Service</th><th>Physiotherapist</th><th>Status</th><th>Note</th></tr></thead><tbody>${sessions || `<tr><td colspan="5">No sessions yet.</td></tr>`}</tbody></table></div>`,
    assessment: `<div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${fact("Presenting condition", shown(patient.condition))}${fact("Affected region", shown(patient.affectedArea))}${fact("Pain score", esc(pain))}${fact("Onset", shown(patient.onset))}${fact("Precautions", shown(patient.precautions))}${fact("Occupation", shown(patient.occupation))}${fact("Referring doctor", shown(patient.referringDoctor))}${fact("Blood group", shown(patient.bloodGroup))}</div>`,
    packages: `<div class="hw-table-wrap"><table class="hw-table"><thead><tr><th>Package</th><th>Credits left</th><th>Status</th></tr></thead><tbody>${packages || `<tr><td colspan="3">No packages on this chart.</td></tr>`}</tbody></table></div>`,
    billing: `<div class="pad hw-row">${canBill() ? `<button class="hw-btn hw-btn-primary" data-add-invoice type="button">Add invoice</button>` : ""}</div><div class="hw-table-wrap"><table class="hw-table"><thead><tr><th>Invoice</th><th>Total</th><th>Due</th><th>Transaction ID</th><th>Status</th><th></th></tr></thead><tbody>${bills || `<tr><td colspan="6">No invoices yet.</td></tr>`}</tbody></table></div>`,
  };
  return {
    markup: `<div class="hw-page space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a class="hw-btn" href="#/patients"><i class="ph ph-arrow-left"></i> Patients</a>
          <div><h1 class="text-lg font-semibold text-heading">${esc(patient.name)}</h1><p class="text-xs text-faint">${esc(patient.code)} · ${esc(patient.branchName)}</p></div>
        </div>
        <div class="flex items-center gap-2">
          ${canEditChart() ? `<button class="h-9 px-4 rounded-xl border border-border bg-w1 text-xs font-semibold" id="edit-chart" type="button">Edit profile</button>` : ""}
          ${canBill() ? `<button class="h-9 px-4 rounded-xl border border-border bg-w1 text-xs font-semibold" id="add-invoice" type="button">Add invoice</button>` : ""}
          <button class="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold" id="schedule-visit" type="button">Schedule</button>
          ${state.user.role === "ORG_ADMIN" ? `<button class="hw-btn" id="export-patient" type="button">Export</button>` : ""}
        </div>
      </div>
      ${patient.isMinor ? `<div class="hw-banner is-info">Minor. Guardian ${esc(patient.guardian?.name)} · ID ending ${esc(patient.guardian?.idLast4)} · consent recorded.</div>` : ""}
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div class="dash-panel overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <div class="flex items-center gap-2"><span class="dash-icon-chip"><i class="ph ph-identification-card"></i></span><div><h2 class="dash-title">Patient profile</h2><p class="dash-subtitle">Contact and identity</p></div></div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">${esc(patient.branchName)}</span>
          </div>
          <div class="p-5 flex flex-wrap gap-5">
            <div class="hw-avatar" style="width:112px;height:112px;font-size:28px">${esc(initials(patient.name))}</div>
            <div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${fact("Gender", esc(patient.gender || "—"))}
              ${fact("Age", esc(ageOf(patient.dob) || "—"))}
              ${fact("Date of birth", esc(patient.dob || "—"))}
              <div class="min-w-0"><p class="text-[10px] text-faint">Phone</p><p class="text-xs font-semibold text-heading"><span id="phone-value">${esc(patient.phoneMasked)}</span>${canReveal() ? ` <button class="hw-link" id="reveal" type="button">Reveal</button>` : ""}</p></div>
              ${fact("Email", shown(patient.email))}
              ${fact("Address", shown(patient.address))}
              ${fact("Emergency contact", shown([patient.emergencyName, patient.emergencyPhone].filter(Boolean).join(" · ")))}
              ${fact("Flags", patient.flags.length ? patient.flags.map((flag) => esc(flag)).join(", ") : "—")}
            </div>
          </div>
        </div>
        <div class="dash-panel overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <div class="flex items-center gap-2"><span class="dash-icon-chip"><i class="ph ph-heartbeat"></i></span><div><h2 class="dash-title">Physiotherapy summary</h2><p class="dash-subtitle">What the treating therapist needs on this visit</p></div></div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-danger/10 text-danger border border-danger/20">Pain ${esc(pain)}</span>
          </div>
          <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${fact("Presenting condition", shown(patient.condition))}
            ${fact("Affected region", shown(patient.affectedArea))}
            ${fact("Onset", shown(patient.onset))}
            ${fact("Occupation", shown(patient.occupation))}
            ${fact("Referring doctor", shown(patient.referringDoctor))}
            ${fact("Blood group", shown(patient.bloodGroup))}
            ${fact("Precautions", shown(patient.precautions))}
            ${fact("Dues", inr(patient.duesPaise))}
            ${fact("Package credits", esc(String(patient.packageCredits)))}
          </div>
        </div>
      </div>
      <section class="dash-panel overflow-hidden">
        <div class="flex flex-wrap gap-1 p-3 border-b border-border-subtle">
          ${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" class="px-4 py-1.5 rounded-lg text-xs font-semibold ${tab === id ? "bg-primary text-on-primary" : "text-muted"}">${label}</button>`).join("")}
        </div>
        ${panels[tab]}
      </section>
    </div>`,
    bind: (root) => {
      root.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => { state.patientTab = button.dataset.tab; render(); });
      root.querySelector("#edit-chart")?.addEventListener("click", () => chartForm(patient));
      root.querySelector("#schedule-visit")?.addEventListener("click", () => bookingForm({ patientId: patient.id }));
      root.querySelectorAll("#add-invoice, [data-add-invoice]").forEach((button) => button.onclick = () => patientInvoiceForm(patient, data.timeline));
      root.querySelectorAll("[data-txn]").forEach((button) => button.onclick = () => transactionForm(button.dataset.txn, button.dataset.ref));
      root.querySelector("#reveal")?.addEventListener("click", async () => {
        const revealed = await api(`/patients/${patient.id}/reveal-phone`, { method: "POST", body: {} });
        root.querySelector("#phone-value").textContent = revealed.phone;
        toast("Phone reveal recorded in the audit log.");
      });
      root.querySelector("#export-patient")?.addEventListener("click", async () => {
        const pack = await api(`/patients/${patient.id}/export`);
        openModal("Patient export", `<pre class="hw-muted" style="white-space:pre-wrap">${esc(JSON.stringify(pack, null, 2))}</pre>`);
      });
    },
  };
}

function chartForm(patient) {
  const groups = ["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((value) => ({ value, label: value || "Not recorded" }));
  const contact = canRegister();
  openModal("Update patient", `
    <form class="hw-stack">
      ${contact ? `<div class="hw-field"><label class="hw-label">Email</label><input class="hw-input" name="email" type="email" value="${esc(patient.email)}"></div>
      <div class="hw-field"><label class="hw-label">Address</label><input class="hw-input" name="address" value="${esc(patient.address)}"></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Emergency contact</label><input class="hw-input" name="emergencyName" value="${esc(patient.emergencyName)}"></div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Emergency phone</label><input class="hw-input" name="emergencyPhone" value="${esc(patient.emergencyPhone)}"></div></div>` : `<p class="hw-muted">Contact details are updated by reception. You can update the clinical record.</p>`}
      <div class="hw-field"><label class="hw-label">Presenting condition</label><input class="hw-input" name="condition" value="${esc(patient.condition)}"></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Affected region</label><input class="hw-input" name="affectedArea" value="${esc(patient.affectedArea)}"></div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Pain score 0–10</label><input class="hw-input" name="painScore" type="number" min="0" max="10" value="${patient.painScore ?? ""}"></div></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Onset</label><input class="hw-input" name="onset" value="${esc(patient.onset)}" placeholder="6 weeks"></div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Occupation</label><input class="hw-input" name="occupation" value="${esc(patient.occupation)}"></div></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Referring doctor</label><input class="hw-input" name="referringDoctor" value="${esc(patient.referringDoctor)}"></div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Blood group</label>${combo("bloodGroup", groups, patient.bloodGroup || "")}</div></div>
      <div class="hw-field"><label class="hw-label">Precautions</label><textarea class="hw-textarea" name="precautions">${esc(patient.precautions)}</textarea></div>
      <button class="hw-btn hw-btn-primary" type="submit">Save chart</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api(`/patients/${patient.id}`, { method: "PATCH", body: form });
        close();
        toast("Patient chart updated.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function ensureBoard(key, defaultFilter) {
  state.boards = state.boards || {};
  if (!state.boards[key]) state.boards[key] = { filter: defaultFilter, query: "", page: 1 };
  return state.boards[key];
}

function matchesAppt(row, filter) {
  if (filter === "booked") return row.status === "BOOKED";
  if (filter === "queue") return ["CHECKED_IN", "IN_SERVICE"].includes(row.status) || row.queueStatus === "WAITING";
  if (filter === "service") return row.status === "IN_SERVICE";
  if (filter === "archive") return ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(row.status);
  return true;
}

function volumeBar(color, count, total) {
  const slots = 16;
  const filled = total ? Math.min(slots, Math.max(count ? 1 : 0, Math.round((count / total) * slots))) : 0;
  return `<div class="flex items-stretch gap-px h-8">${Array.from({ length: slots }, (_, index) => `<div class="flex-1 rounded-sm" style="background:${color};opacity:${index < filled ? 1 : 0.15}"></div>`).join("")}</div>`;
}

function statCard(icon, label, value, total, color) {
  return `<div class="dash-panel p-4 flex flex-col gap-2"><div class="flex items-center gap-2"><i class="ph ${icon} text-sm" style="color:${color}"></i><span class="text-xs font-medium text-muted">${esc(label)}</span></div><p class="text-2xl font-bold text-heading leading-none">${value}</p>${volumeBar(color, value, Math.max(total, 1))}</div>`;
}

function statusPill(row) {
  const map = {
    BOOKED: ["border-primary text-primary", "Accepted"],
    CHECKED_IN: ["border-warning text-warning", "In Queue"],
    IN_SERVICE: ["border-info text-info", "In Service"],
    COMPLETED: ["border-primary text-primary", "Done"],
    CANCELLED: ["border-danger text-danger", "Cancelled"],
    NO_SHOW: ["border-danger text-danger", "No-show"],
  };
  const [cls, label] = map[row.status] || ["border-border text-muted", row.status || "Unknown"];
  return `<span class="px-2.5 py-0.5 rounded-full border ${cls} text-[11px] font-medium shrink-0">${esc(label)}</span>`;
}

function actionPill(label, icon, attrs, tone) {
  const cls = tone === "primary"
    ? "flex-1 h-9 rounded-full bg-primary text-on-primary text-xs font-medium flex items-center justify-center gap-2"
    : tone === "danger"
      ? "flex-1 h-9 rounded-full border border-danger text-danger text-xs font-medium flex items-center justify-center gap-2"
      : "flex-1 h-9 rounded-full border border-border text-xs font-medium flex items-center justify-center gap-2";
  return `<button class="${cls}" type="button" ${attrs}><i class="ph ${icon} text-sm"></i>${label}</button>`;
}

function canCancel(row) {
  if (!["BOOKED", "CHECKED_IN"].includes(row.status) || state.user.role === "PATIENT") return false;
  if (state.user.role === "PHYSIO") return row.physioId === state.user.physioId;
  return true;
}

function cardActions(row) {
  const buttons = [];
  if (canCancel(row)) buttons.push(actionPill("Cancel", "ph-x", `data-cancel="${row.id}"`, "danger"));
  if (row.status === "BOOKED" && canWalkIn()) buttons.push(actionPill("Check in", "ph-check", `data-checkin="${row.id}"`, "primary"));
  if (["BOOKED", "CHECKED_IN"].includes(row.status) && canStart(row) && !(row.status === "BOOKED" && canWalkIn())) buttons.push(actionPill("Start", "ph-play", `data-start="${row.id}"`, "primary"));
  if (row.status === "IN_SERVICE" && canStart(row)) {
    buttons.push(actionPill("Undo", "ph-arrow-u-up-left", `data-undo="${row.id}"`, "ghost"));
    buttons.push(actionPill("Complete", "ph-check", `data-complete="${row.id}"`, "primary"));
  }
  if (row.status === "COMPLETED") return `<a class="w-full h-9 rounded-full border border-border text-xs font-medium flex items-center justify-center" href="#/patient/${row.patientId}">Open chart</a>`;
  if (["CANCELLED", "NO_SHOW"].includes(row.status)) return `<button class="w-full h-9 rounded-full border border-danger text-danger text-xs font-medium" type="button" disabled>${row.status === "NO_SHOW" ? "No-show" : "Cancelled"}</button>`;
  return buttons.length ? `<div class="flex items-center gap-2">${buttons.join("")}</div>` : "";
}

function appointmentCard(row) {
  return `<article class="bg-w1 rounded-2xl p-4 border border-border-subtle flex flex-col gap-3">
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-start gap-2 min-w-0">
        <span class="w-6 h-6 rounded-full bg-subtle text-faint text-xs flex items-center justify-center shrink-0">#</span>
        <div class="min-w-0"><p class="text-sm font-semibold text-heading truncate">${esc(row.patientCode || "Visit")}</p><p class="text-[11px] text-faint mt-0.5 truncate">With ${esc(row.physioName)}</p></div>
      </div>
      ${statusPill(row)}
    </div>
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-9 h-9 rounded-full bg-primary-soft text-primary text-xs font-semibold flex items-center justify-center shrink-0">${esc(initials(row.patientName))}</span>
        <div class="min-w-0"><p class="text-[10px] text-faint">Patient Name</p><a class="text-xs font-semibold text-heading truncate block" href="#/patient/${row.patientId}">${esc(row.patientName)}</a></div>
      </div>
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-7 h-7 rounded-full bg-subtle text-faint flex items-center justify-center shrink-0"><i class="ph ph-phone text-xs"></i></span>
        <div class="min-w-0"><p class="text-[10px] text-faint">Phone</p><p class="text-xs font-semibold text-heading truncate">${esc(row.phoneMasked || "—")}</p></div>
      </div>
    </div>
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-7 h-7 rounded-full bg-subtle text-faint flex items-center justify-center shrink-0"><i class="ph ph-calendar-blank text-xs"></i></span>
        <div class="min-w-0"><p class="text-[10px] text-faint">Date &amp; Time</p><p class="text-xs font-semibold text-heading truncate">${esc(dayStamp(row.start))} · ${esc(row.serviceName)}</p></div>
      </div>
      <span class="px-3 py-1 rounded-full bg-primary-soft text-primary text-[11px] font-medium shrink-0">${esc(clock(row.start))}–${esc(clock(row.end))}</span>
    </div>
    <div class="border-t border-border-subtle"></div>
    ${cardActions(row)}
  </article>`;
}

function appointmentBoard(key, rows, options) {
  const board = ensureBoard(key, options.defaultFilter);
  const query = board.query.trim().toLowerCase();
  const filtered = rows.filter((row) => matchesAppt(row, board.filter) && (!query || `${row.patientName} ${row.patientCode} ${row.physioName} ${row.serviceName}`.toLowerCase().includes(query)));
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (board.page > pages) board.page = pages;
  const slice = filtered.slice((board.page - 1) * pageSize, board.page * pageSize);
  const booked = rows.filter((row) => row.status === "BOOKED").length;
  const queued = rows.filter((row) => row.status === "CHECKED_IN" || row.queueStatus === "WAITING").length;
  const serving = rows.filter((row) => row.status === "IN_SERVICE").length;
  const archived = rows.filter((row) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(row.status)).length;
  const filters = [["all", "All Appointments"], ["booked", "Accepted"], ["queue", "In Queue"], ["service", "In Service"], ["archive", "Archive"]];
  const headerActions = [
    options.walkIn && canWalkIn() ? `<button class="h-9 px-4 rounded-xl border border-border bg-w1 text-xs font-semibold" id="walk-in" type="button">Walk-in</button>` : "",
    `<button class="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold inline-flex items-center gap-2" id="add-appointment" type="button"><i class="ph ph-plus text-sm"></i>Add Appointment</button>`,
  ].join("");
  return {
    markup: `<div class="hw-page space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center"><i class="ph ${options.icon} text-primary text-lg"></i></div>
          <div><h1 class="text-lg font-semibold text-heading">${esc(options.title)}</h1><p class="text-xs text-faint mt-0.5">${esc(options.subtitle)}</p></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none"></i>
            <input id="appt-search" type="search" value="${esc(board.query)}" placeholder="Search appointments…" class="h-9 w-56 pl-9 pr-4 rounded-xl bg-w1 border border-border text-xs text-text">
          </div>
          ${headerActions}
        </div>
      </div>
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
        ${statCard("ph-calendar-check", "Total", rows.length, rows.length, "var(--color-info)")}
        ${statCard("ph-check-circle", "Accepted", booked, rows.length, "var(--color-primary)")}
        ${statCard("ph-queue", "In Queue", queued, rows.length, "var(--color-warning)")}
        ${statCard("ph-heartbeat", "In Service", serving, rows.length, "var(--color-info)")}
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex items-center gap-1 p-1 bg-w1 border border-border rounded-xl overflow-x-auto">
          ${filters.map(([id, label]) => `<button type="button" data-filter="${id}" class="px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${board.filter === id ? "bg-primary text-on-primary" : "text-muted"}">${label}</button>`).join("")}
        </div>
        <span class="text-xs text-muted">${archived} in archive</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        ${slice.map(appointmentCard).join("") || `<div class="dash-panel p-6 text-sm text-muted">No appointments in this view.</div>`}
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>Showing ${filtered.length ? (board.page - 1) * pageSize + 1 : 0}–${Math.min(board.page * pageSize, filtered.length)} of ${filtered.length}</span>
        <div class="flex items-center gap-2"><button class="hw-btn" id="appt-prev" type="button">Previous</button><span>${board.page} / ${pages}</span><button class="hw-btn" id="appt-next" type="button">Next</button></div>
      </div>
    </div><!--hw-page-->`,
    bind(root) {
      bindAppointmentActions(root);
      root.querySelector("#add-appointment")?.addEventListener("click", () => bookingForm());
      root.querySelector("#walk-in")?.addEventListener("click", () => walkInForm());
      root.querySelector("#appt-search")?.addEventListener("change", (event) => { board.query = event.target.value; board.page = 1; render(); });
      root.querySelectorAll("[data-filter]").forEach((button) => button.onclick = () => { board.filter = button.dataset.filter; board.page = 1; render(); });
      root.querySelector("#appt-prev").onclick = () => { if (board.page > 1) { board.page -= 1; render(); } };
      root.querySelector("#appt-next").onclick = () => { if (board.page < pages) { board.page += 1; render(); } };
    },
  };
}

async function weekBoard(appointments) {
  const boot = await api(`/bootstrap?${branchQuery()}`);
  const roster = boot.physios.filter((physio) => physio.branchId === state.branchId);
  if (!state.calendarPhysio || !roster.some((physio) => physio.id === state.calendarPhysio)) state.calendarPhysio = roster[0]?.id || "";
  const days = weekDates(state.weekOffset || 0);
  const mine = appointments.filter((row) => row.physioId === state.calendarPhysio && !["CANCELLED", "NO_SHOW"].includes(row.status));
  const hours = [];
  for (let hour = 8; hour < 20; hour += 1) for (let minute = 0; minute < 60; minute += 15) hours.push([hour, minute]);
  const cells = hours.map(([hour, minute]) => {
    const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const slots = days.map((day) => {
      const start = slotIso(day.key, hour, minute);
      const end = new Date(new Date(start).getTime() + 15 * 60000).toISOString();
      const hits = mine.filter((row) => row.start < end && start < row.end);
      const opener = hits.find((row) => row.start >= start && row.start < end) || hits[0];
      const physio = roster.find((item) => item.id === state.calendarPhysio);
      const cap = physio?.parallelTherapyCapacity || 1;
      const consult = hits.some((row) => row.serviceKind === "CONSULT");
      const full = consult || hits.length >= cap;
      const off = ["OFF_DUTY", "UNAVAILABLE"].includes(physio?.availability);
      let kind = "open";
      if (hits.length && full) kind = opener?.status === "IN_SERVICE" ? "service" : opener?.status === "CHECKED_IN" ? "wait" : "busy";
      else if (hits.length) kind = "shared";
      else if (physio && onLeaveDay(physio, day.key)) kind = "leave";
      else if (!physio || off || !slotOpen(physio, day.key, hour, minute)) kind = "closed";
      const tone = { service: "is-service", wait: "is-wait", busy: "is-busy", shared: "is-mine", leave: "is-leave", closed: "is-closed", open: "" }[kind];
      const text = kind === "shared"
        ? `<strong style="display:block;font-size:12px">${hits.length}/${cap}</strong><span class="hw-muted">Room for therapy</span>`
        : opener && hits.length
          ? `<strong style="display:block;font-size:12px">${esc(opener.patientName)}</strong><span class="hw-muted">${esc(opener.serviceName)}${opener.durationMin ? ` · ${esc(lengthLabel(opener))}` : ""}</span>`
          : kind === "leave" ? `<span class="hw-muted">Leave</span>` : kind === "open" ? `<span class="hw-muted">Open</span>` : "";
      return `<button type="button" class="hw-slot ${tone}" data-start="${start}" data-kind="${kind}" data-appt="${opener && full ? opener.id : ""}" ${kind === "closed" ? "disabled" : ""}>${text}</button>`;
    }).join("");
    return `<div class="hw-cal-time">${label}</div>${slots}`;
  }).join("");
  return {
    markup: `<section class="dash-panel mt-2"><div class="pad flex flex-wrap items-center justify-between gap-3"><div><h2 class="dash-title">Week board</h2><p class="dash-subtitle">${esc(hoursLabel(roster.find((physio) => physio.id === state.calendarPhysio)))}. Click the dates to open the calendar. Open a slot to book it, or a booked slot to cancel it.</p></div><div class="hw-row">${weekToolbar(days)}</div></div><div class="pad" style="max-width:360px">${combo("calendarPhysio", roster.map((physio) => ({ value: physio.id, label: `${physio.name} · ${physio.specialty}` })), state.calendarPhysio)}</div><div class="hw-cal"><div class="hw-cal-grid"><div class="hw-cal-head">Time</div>${days.map((day) => `<div class="hw-cal-head ${day.today ? "is-today" : ""}">${esc(day.label)}${day.today ? "<div>Today</div>" : ""}</div>`).join("")}${cells}</div><div class="pad hw-row"><span class="hw-chip is-done">Open</span><span class="hw-chip is-muted">Booked</span><span class="hw-chip is-waiting">Leave</span><span class="hw-muted">Gray times are outside consultation hours.</span></div></div></section>`,
    bind(root) {
      root.querySelector("[data-name=calendarPhysio]")?.addEventListener("change", (event) => {
        state.calendarPhysio = event.currentTarget.querySelector("input[type=hidden]").value;
        render();
      });
      root.querySelector("#week-prev").onclick = () => { state.weekOffset = (state.weekOffset || 0) - 1; render(); };
      root.querySelector("#week-next").onclick = () => { state.weekOffset = (state.weekOffset || 0) + 1; render(); };
      root.querySelector("#week-today").onclick = () => { state.weekOffset = 0; render(); };
      bindDatePicker(root, (dateKey) => { state.weekOffset = weekOffsetFor(dateKey); render(); });
      root.querySelectorAll(".hw-slot").forEach((slot) => slot.onclick = () => {
        if (slot.disabled || slot.dataset.kind === "closed") return;
        const row = mine.find((item) => item.id === slot.dataset.appt);
        const physio = roster.find((item) => item.id === state.calendarPhysio);
        if (slot.dataset.kind === "leave") return openModal("On leave", `<p>${esc(physio?.name || "This physiotherapist")} is on leave this day.</p>`);
        if (!row) return bookingForm({ physioId: state.calendarPhysio, start: slot.dataset.start });
        openModal(`${row.patientName} · ${when(row.start)}`, `<div class="hw-stack"><p>${esc(row.serviceName)} · ${esc(lengthLabel(row))} · ${chip(row.status)}</p>${cardActions(row)}</div>`, (body) => bindAppointmentActions(body));
      });
    },
  };
}

function pageHead(title, sub, actions = "") {
  return `<div class="hw-page"><div class="hw-head"><div><h1 class="hw-title">${esc(title)}</h1><p class="hw-sub">${esc(sub)}</p></div><div class="hw-row">${actions}</div></div>`;
}

function table(headers, rows, empty) {
  return `<section class="dash-panel hw-table-wrap"><table class="hw-table"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table></section></div>`;
}

function appointmentRow(row) {
  const actions = [];
  if (["BOOKED"].includes(row.status) && canWalkIn()) actions.push(`<button class="hw-btn" data-checkin="${row.id}" type="button">Check in</button>`);
  if (["BOOKED", "CHECKED_IN"].includes(row.status) && canStart(row)) actions.push(`<button class="hw-btn hw-btn-primary" data-start="${row.id}" type="button">Start</button>`);
  if (row.status === "IN_SERVICE" && canStart(row)) actions.push(`<button class="hw-btn hw-btn-primary" data-complete="${row.id}" type="button">Complete</button><button class="hw-btn" data-undo="${row.id}" type="button">Undo</button>`);
  if (canCancel(row)) actions.push(`<button class="hw-btn" data-cancel="${row.id}" type="button">Cancel</button>`);
  return `<tr><td>${esc(when(row.start))}</td><td><a class="hw-link" href="#/patient/${row.patientId}">${esc(row.patientName)}</a><div class="hw-muted">${esc(row.patientCode)}</div></td><td>${esc(row.physioName)}</td><td>${esc(row.serviceName)}<div class="hw-muted">${esc(lengthLabel(row))}</div></td><td>${chip(row.queueStatus || row.status)}</td><td class="hw-row">${actions.join("")}</td></tr>`;
}

function canManage() { return ["ORG_ADMIN", "BRANCH_ADMIN"].includes(state.user.role); }
function canBill() { return ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(state.user.role); }
function durationChoices(service) {
  if (Array.isArray(service?.durations) && service.durations.length) return service.durations;
  const slot = service?.durationMin || service?.minDurationMin || 30;
  if (service?.kind === "CONSULT") return [slot];
  const maxSlots = Math.min(8, service?.maxSlots || 4);
  return Array.from({ length: maxSlots }, (_, index) => slot * (index + 1));
}
function slotOptions(service) {
  const slot = service?.durationMin || service?.minDurationMin || 30;
  return durationChoices(service).map((minutes) => {
    const count = slot > 0 && minutes % slot === 0 ? minutes / slot : 1;
    const label = count === 1 ? `1 slot · ${minutes} min` : `${count} slots · ${minutes} min`;
    return { value: String(minutes), label, count };
  });
}
function lengthLabel(row) {
  if (!row?.durationMin) return "";
  const count = row.slotCount || 1;
  return count > 1 ? `${count} slots · ${row.durationMin} min` : `1 slot · ${row.durationMin} min`;
}
function durationMarkup(service) {
  const options = slotOptions(service);
  const slot = service?.durationMin || service?.minDurationMin || 30;
  if (!service || service.kind === "CONSULT" || options.length < 2) {
    const only = options[0] || { value: String(slot), label: `1 slot · ${slot} min` };
    const note = service?.kind === "CONSULT" ? "A consultation is one slot only." : "This therapy is booked as one slot.";
    return `<input type="hidden" name="durationMin" value="${esc(only.value)}"><p class="hw-input">${esc(only.label)}</p><p class="hw-muted">${note}</p>`;
  }
  return `${combo("durationMin", options, options[0].value)}<p class="hw-muted">One slot is ${slot} min. Two slots is ${slot * 2} min. A consultation stays one slot.</p>`;
}
function refillDuration(body, services) {
  const serviceId = body.querySelector("[data-name=serviceId] input[type=hidden]")?.value;
  const service = services.find((item) => item.id === serviceId) || services[0];
  const host = body.querySelector("[data-duration]");
  if (!host) return;
  host.innerHTML = durationMarkup(service);
  bindCombos(host);
}
function durationField(services, serviceId) {
  const service = services.find((item) => item.id === serviceId) || services[0];
  return `<div data-duration>${durationMarkup(service)}</div>`;
}
function canEditHours() { return ["ORG_ADMIN", "BRANCH_ADMIN", "PHYSIO"].includes(state.user.role); }
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function consultOf(physio) {
  const consult = physio?.consult;
  if (!consult?.start || !consult?.end || !Array.isArray(consult.days)) return { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" };
  return consult;
}
function minutesOf(value) {
  const [hour, minute] = String(value || "0:0").split(":").map(Number);
  return hour * 60 + minute;
}
function weekdayOfKey(key) {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}
function onLeaveDay(physio, key) {
  return (physio?.leave || []).some((item) => item.from <= key && key <= item.to);
}
function slotOpen(physio, key, hour, minute, step = 15) {
  const consult = consultOf(physio);
  const mins = hour * 60 + minute;
  return consult.days.includes(weekdayOfKey(key)) && mins >= minutesOf(consult.start) && mins + step <= minutesOf(consult.end);
}
function hoursLabel(physio) {
  if (!physio) return "No consultation hours";
  const consult = consultOf(physio);
  const days = [...consult.days].sort((a, b) => a - b).map((day) => WEEKDAYS[day]).join(", ");
  return `${consult.start}–${consult.end} · ${days}`;
}
function hoursEditor(schedules) {
  return `<div class="hw-directory">${schedules.physios.map((physio) => {
    const consult = consultOf(physio);
    const leave = physio.leave || [];
    return `<article class="bg-w1 p-5"><form class="hw-stack" data-hours="${physio.id}">
      <strong>${esc(physio.name)}</strong>
      <p class="hw-muted">${esc(physio.specialty)} · ${esc(physio.branchName)}</p>
      <div class="hw-row">${WEEKDAYS.map((label, index) => `<label class="hw-check"><input type="checkbox" name="days" value="${index}" ${consult.days.includes(index) ? "checked" : ""}> ${label}</label>`).join("")}</div>
      <div class="hw-row"><div class="hw-field"><label class="hw-label">From</label><input class="hw-input" type="time" name="start" value="${esc(consult.start)}" required></div><div class="hw-field"><label class="hw-label">To</label><input class="hw-input" type="time" name="end" value="${esc(consult.end)}" required></div></div>
      <div class="leave-list">${leave.map((item) => `<div class="hw-row"><input class="hw-input" type="date" name="leaveFrom" value="${esc(item.from)}"><input class="hw-input" type="date" name="leaveTo" value="${esc(item.to)}"></div>`).join("")}<div class="hw-row"><input class="hw-input" type="date" name="leaveFrom" aria-label="Leave from"><input class="hw-input" type="date" name="leaveTo" aria-label="Leave to"></div></div>
      <button class="hw-btn" type="button" data-add-leave>Add leave dates</button>
      ${canManage() ? `<div class="hw-field"><label class="hw-label">Parallel therapy capacity</label><input class="hw-input" name="parallelTherapyCapacity" type="number" min="1" max="20" placeholder="Inherit ${physio.effectiveCapacity || ""}" value="${physio.parallelTherapyCapacity ?? ""}"></div>` : ""}
      <button class="hw-btn hw-btn-primary" type="submit">Save hours</button>
      <p class="hw-error" hidden></p>
    </form></article>`;
  }).join("") || `<article class="bg-w1 p-5">No consultation hours to edit.</article>`}</div>`;
}
function bindHours(root) {
  root.querySelectorAll("[data-add-leave]").forEach((button) => button.onclick = () => {
    const row = document.createElement("div");
    row.className = "hw-row";
    row.innerHTML = `<input class="hw-input" type="date" name="leaveFrom" aria-label="Leave from"><input class="hw-input" type="date" name="leaveTo" aria-label="Leave to">`;
    button.previousElementSibling.append(row);
  });
  root.querySelectorAll("[data-hours]").forEach((form) => form.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const froms = data.getAll("leaveFrom");
    const tos = data.getAll("leaveTo");
    const leave = froms.map((from, index) => ({ from, to: tos[index] })).filter((item) => item.from && item.to);
    try {
      await api(`/physios/${form.dataset.hours}/consult`, { method: "PATCH", body: { days: data.getAll("days").map(Number), start: data.get("start"), end: data.get("end"), leave, ...(form.querySelector("[name=parallelTherapyCapacity]") ? { parallelTherapyCapacity: data.get("parallelTherapyCapacity") } : {}) } });
      toast("Consultation hours saved.");
      render();
    } catch (error) {
      const node = form.querySelector(".hw-error");
      node.hidden = false;
      node.textContent = formError(error);
    }
  });
}
function canChangeStatus(physio) { return state.user.role === "PHYSIO" ? physio.id === state.user.physioId : canManage(); }
function physioCard(physio) {
  return `<article class="bg-w1 p-5"><div class="hw-row" style="justify-content:space-between">${chip(physio.liveStatus)}${chip(physio.engagement)}</div><div style="display:grid;justify-items:center;margin:12px 0"><div class="hw-avatar">${esc(initials(physio.name))}</div><strong style="margin-top:8px;text-align:center">${esc(physio.name)}</strong><span class="hw-muted">${esc(physio.specialty)}</span></div><div class="hw-row" style="justify-content:space-between"><span class="hw-muted">${physio.experienceYears != null ? `${physio.experienceYears} years` : `Rating ${physio.rating ?? "—"}`}</span><span class="hw-muted">${physio.reviewCount ?? 0} reviews</span></div><p class="hw-muted" style="margin-top:8px">${esc(hoursLabel(physio))}</p></article>`;
}
function canRegister() { return ["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(state.user.role); }
function canReveal() { return canRegister(); }
function canWalkIn() { return canRegister(); }
function canSetStatus() { return ["ORG_ADMIN", "BRANCH_ADMIN", "PHYSIO"].includes(state.user.role); }
function canStart(row) { return state.user.role !== "PATIENT" && (state.user.role !== "PHYSIO" || row.physioId === state.user.physioId); }

function bindAppointmentActions(root) {
  root.querySelectorAll("[data-checkin]").forEach((button) => button.onclick = () => run(() => api(`/appointments/${button.dataset.checkin}/check-in`, { method: "POST", body: {} })));
  root.querySelectorAll("[data-start]").forEach((button) => button.onclick = () => run(() => api(`/visits/${button.dataset.start}/start`, { method: "POST", body: {} })));
  root.querySelectorAll("[data-undo]").forEach((button) => button.onclick = () => run(() => api(`/visits/${button.dataset.undo}/undo`, { method: "POST", body: {} })));
  root.querySelectorAll("[data-complete]").forEach((button) => button.onclick = () => completeForm(button.dataset.complete));
  root.querySelectorAll("[data-cancel]").forEach((button) => button.onclick = () => reasonAction("Cancel appointment", "/cancel", button.dataset.cancel, ["PATIENT_REQUEST", "CLINIC_REQUEST", "PHYSIO_UNAVAILABLE", "OTHER"]));
}

async function run(work) {
  try {
    await work();
    toast("Saved.");
    render();
  } catch (error) {
    toast(formError(error));
  }
}

function syncThemeIcon() {
  const dark = document.documentElement.classList.contains("dark");
  document.querySelectorAll("#theme-icon, #login-theme-icon").forEach((icon) => {
    icon.className = dark ? "ph ph-sun text-xl" : "ph ph-moon text-xl";
  });
}

function isoToLocalInput(iso) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

async function clinicianForm(defaultRole) {
  const boot = await api(`/bootstrap?${branchQuery()}`);
  const roles = state.user.role === "ORG_ADMIN"
    ? [{ value: "PHYSIO", label: "Physiotherapist" }, { value: "STAFF", label: "Reception" }, { value: "BRANCH_ADMIN", label: "Branch manager" }]
    : [{ value: "PHYSIO", label: "Physiotherapist" }, { value: "STAFF", label: "Reception" }];
  openModal(defaultRole === "PHYSIO" ? "Add physiotherapist" : "Add employee", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Name</label><input class="hw-input" name="name" required></div>
      <div class="hw-field"><label class="hw-label">Work email</label><input class="hw-input" name="email" type="email" required></div>
      <div class="hw-field"><label class="hw-label">Mobile</label><input class="hw-input" name="phone"></div>
      <div class="hw-field"><label class="hw-label">Role</label>${combo("role", roles, defaultRole)}</div>
      ${state.user.role === "ORG_ADMIN" ? `<div class="hw-field" data-single-branch><label class="hw-label">Branch</label>${combo("branchId", boot.branches.map((branch) => ({ value: branch.id, label: branch.name })), state.branchId)}</div><div class="hw-field" data-admin-branches hidden><label class="hw-label">Assigned branches</label><div class="hw-stack">${boot.branches.map((branch) => `<label class="hw-check"><input type="checkbox" name="branchIds" value="${esc(branch.id)}" ${branch.id === state.branchId ? "checked" : ""}> ${esc(branch.name)}</label>`).join("")}</div></div>` : `<input type="hidden" name="branchId" value="${esc(state.branchId)}">`}
      <div class="hw-field" data-physio-only><label class="hw-label">Specialty</label><input class="hw-input" name="specialty" placeholder="Musculoskeletal, sports, neuro"></div>
      <div class="hw-field" data-physio-only><label class="hw-label">Engagement</label>${combo("engagement", [{ value: "EMPLOYEE", label: "Employee" }, { value: "CONSULTANT", label: "Consultant" }], "EMPLOYEE")}</div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Gender</label>${combo("gender", [{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }, { value: "Other", label: "Other" }])}</div><div class="hw-field" style="flex:1" data-physio-only><label class="hw-label">Experience in years</label><input class="hw-input" name="experienceYears" type="number" min="0"></div></div>
      <p class="hw-muted">The new sign-in uses password HealthWise#2026 and the local verification code.</p>
      <button class="hw-btn hw-btn-primary" type="submit">Save</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    const toggle = () => {
      const role = body.querySelector("[data-name=role] input[type=hidden]").value;
      body.querySelectorAll("[data-physio-only]").forEach((node) => { node.hidden = role !== "PHYSIO"; });
      const single = body.querySelector("[data-single-branch]");
      const many = body.querySelector("[data-admin-branches]");
      if (single) single.hidden = role === "BRANCH_ADMIN";
      if (many) many.hidden = role !== "BRANCH_ADMIN";
    };
    body.querySelector("[data-name=role]").addEventListener("change", toggle);
    toggle();
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const form = Object.fromEntries(formData);
      form.branchIds = formData.getAll("branchIds");
      try {
        const saved = await api(form.role === "PHYSIO" ? "/physios" : "/employees", { method: "POST", body: { ...form, branchId: form.branchId || state.branchId } });
        close();
        toast(`${saved.name} added for ${saved.email}.`);
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function branchForm() {
  openModal("Add branch", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Branch name</label><input class="hw-input" name="name" required placeholder="Jayanagar"></div>
      <div class="hw-field"><label class="hw-label">Code</label><input class="hw-input" name="code" required placeholder="BLR-JAY" maxlength="12"></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">City</label><input class="hw-input" name="city" required value="Bengaluru"></div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Hours</label><input class="hw-input" name="hours" value="08:00–20:00"></div></div>
      <p class="hw-muted">Service and package prices start as a copy of the first branch. The new branch appears in your branch list.</p>
      <button class="hw-btn hw-btn-primary" type="submit">Create branch</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        const saved = await api("/branches", { method: "POST", body: form });
        close();
        toast(`${saved.branch.name} is open.`);
        await loadBranches();
        state.settingsTab = "branches";
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function assignAdminForm(branchId, directory) {
  const people = directory.candidates || [];
  if (!people.length) {
    openModal("Assign branch admin", `<p class="hw-muted">Add a reception user or physiotherapist first, then assign them here.</p>`);
    return;
  }
  const boxes = () => directory.branches.map((branch) => `<label class="hw-check"><input type="checkbox" name="branchIds" value="${esc(branch.id)}" ${branch.id === branchId ? "checked" : ""}> ${esc(branch.name)}</label>`).join("");
  openModal("Assign branch admin", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">User</label>${combo("userId", people.map((person) => ({ value: person.id, label: `${person.name} · ${ROLES[person.role] || person.role}` })))}</div>
      <div class="hw-field"><label class="hw-label">Branches they can open</label><div class="hw-stack" id="assign-branches">${boxes()}</div></div>
      <p class="hw-muted">They sign in as a branch admin and the branch list shows only these branches.</p>
      <button class="hw-btn hw-btn-primary" type="submit">Assign</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    const sync = () => {
      const userId = body.querySelector("[data-name=userId] input[type=hidden]").value;
      const person = people.find((item) => item.id === userId);
      const chosen = new Set(person?.branchIds || []);
      chosen.add(branchId);
      body.querySelectorAll("input[name=branchIds]").forEach((input) => { input.checked = chosen.has(input.value); });
    };
    body.querySelector("[data-name=userId]").addEventListener("change", sync);
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const saved = await api("/branches/admins", { method: "POST", body: { userId: form.get("userId"), branchIds: form.getAll("branchIds") } });
        close();
        toast(`${saved.name} can open ${saved.branchIds.length} branch${saved.branchIds.length === 1 ? "" : "es"}.`);
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function catalogForm(kind) {
  openModal(kind === "service" ? "Add service" : "Add package", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Name</label><input class="hw-input" name="name" required></div>
      ${kind === "service" ? `<div class="hw-field"><label class="hw-label">Type</label>${combo("kind", [{ value: "THERAPY", label: "Therapy" }, { value: "CONSULT", label: "Consultation" }])}</div><div class="hw-row"><div class="hw-field"><label class="hw-label">Minutes in one slot</label><input class="hw-input" name="slotMin" type="number" min="5" value="40" required></div><div class="hw-field" id="max-slots-field"><label class="hw-label">Maximum slots</label><input class="hw-input" name="maxSlots" type="number" min="1" max="8" value="4" required></div></div><p class="hw-muted">Therapy can be booked as more than one slot. A 40 min therapy booked for 2 slots lasts 80 min. A consultation is always one slot.</p>` : `<div class="hw-field"><label class="hw-label">Credits</label><input class="hw-input" name="credits" type="number" min="1" value="8" required></div>`}
      <div class="hw-field"><label class="hw-label">Price in rupees</label><input class="hw-input" name="priceRupees" type="number" min="0" step="0.01" required></div>
      ${state.user.role === "ORG_ADMIN" ? `<label class="hw-check"><input type="checkbox" name="applyAll" checked> Offer at every branch at this price</label>` : `<p class="hw-muted">This is added only for your branch.</p>`}
      <button class="hw-btn hw-btn-primary" type="submit">Save</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("[data-name=kind]")?.addEventListener("change", (event) => {
      const consult = event.currentTarget.querySelector("input[type=hidden]").value === "CONSULT";
      const input = body.querySelector("[name=maxSlots]");
      if (!input) return;
      input.readOnly = consult;
      if (consult) input.value = "1";
    });
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const payload = { name: form.get("name"), priceRupees: Number(form.get("priceRupees")), applyAll: form.get("applyAll") === "on", branchId: state.branchId };
      if (kind === "service") {
        payload.kind = form.get("kind");
        payload.slotMin = Number(form.get("slotMin"));
        payload.maxSlots = form.get("kind") === "CONSULT" ? 1 : Number(form.get("maxSlots"));
      } else payload.credits = Number(form.get("credits"));
      try {
        await api(kind === "service" ? "/services" : "/packages/definitions", { method: "POST", body: payload });
        close();
        toast(kind === "service" ? "Service added." : "Package added.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function serviceEditForm(service) {
  if (!service) return;
  openModal(`Edit ${service.name}`, `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Name</label><input class="hw-input" name="name" value="${esc(service.name)}" required></div>
      <div class="hw-field"><label class="hw-label">Type</label>${combo("kind", [{ value: "THERAPY", label: "Therapy" }, { value: "CONSULT", label: "Consultation" }], service.kind || "THERAPY")}</div>
      <div class="hw-row"><div class="hw-field"><label class="hw-label">Minutes in one slot</label><input class="hw-input" name="slotMin" type="number" min="5" value="${service.durationMin}" required></div><div class="hw-field"><label class="hw-label">Maximum slots</label><input class="hw-input" name="maxSlots" type="number" min="1" max="8" value="${service.kind === "CONSULT" ? 1 : (service.maxSlots || 4)}" ${service.kind === "CONSULT" ? "readonly" : ""} required></div></div>
      <label class="hw-check"><input type="checkbox" name="active" ${service.active === false ? "" : "checked"}> Active for new bookings</label>
      <p class="hw-muted">A consultation is one slot. Therapy can use several slots, so 40 min × 2 is 80 min. Visits already booked keep their original length.</p>
      <button class="hw-btn hw-btn-primary" type="submit">Save therapy</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("[data-name=kind]")?.addEventListener("change", (event) => {
      const consult = event.currentTarget.querySelector("input[type=hidden]").value === "CONSULT";
      const input = body.querySelector("[name=maxSlots]");
      if (!input) return;
      input.readOnly = consult;
      if (consult) input.value = "1";
    });
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        await api(`/services/${service.id}`, { method: "PATCH", body: { name: form.get("name"), kind: form.get("kind"), slotMin: Number(form.get("slotMin")), maxSlots: form.get("kind") === "CONSULT" ? 1 : Number(form.get("maxSlots")), active: form.get("active") === "on" } });
        close();
        toast("Therapy updated. Past bookings are unchanged.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function defaultSlot() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hour = Math.min(19, Number(parts.hour) + 1);
  return `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:00`;
}

function toIso(value) {
  return new Date(`${value}:00+05:30`).toISOString();
}

async function optionsFor(branchId = state.branchId) {
  const [boot, patients] = await Promise.all([
    api(`/bootstrap?branchId=${branchId}`),
    state.user.role === "PATIENT" ? { patients: [] } : api(`/patients?q=&branchId=${branchId}`),
  ]);
  return { boot, patients: patients.patients };
}

function patientForm() {
  openModal("New patient", `
    <form id="patient-form-modal" class="hw-stack">
      <div class="hw-field"><label class="hw-label">Name</label><input class="hw-input" name="name" required></div>
      <div class="hw-field"><label class="hw-label">Mobile</label><input class="hw-input" name="phone" required></div>
      <div class="hw-row"><div class="hw-field" style="flex:1"><label class="hw-label">Gender</label>${combo("gender", [{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }, { value: "Other", label: "Other" }])}</div>
      <div class="hw-field" style="flex:1"><label class="hw-label">Date of birth</label><input class="hw-input" type="date" name="dob" required></div></div>
      <label class="hw-check"><input type="checkbox" name="isMinor" id="is-minor"> Minor — guardian, ID and consent required</label>
      <div id="guardian-fields" hidden>
        <div class="hw-field"><label class="hw-label">Guardian name</label><input class="hw-input" name="guardianName"></div>
        <div class="hw-field"><label class="hw-label">Guardian ID last 4</label><input class="hw-input" name="guardianIdLast4" maxlength="4"></div>
        <label class="hw-check"><input type="checkbox" name="guardianConsent"> Guardian consent recorded</label>
      </div>
      <button class="hw-btn hw-btn-primary" type="submit">Save patient</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("#is-minor").onchange = (event) => { body.querySelector("#guardian-fields").hidden = !event.target.checked; };
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const created = await api("/patients", { method: "POST", body: { name: form.get("name"), phone: form.get("phone"), gender: form.get("gender"), dob: form.get("dob"), branchId: state.branchId, isMinor: form.get("isMinor") === "on", guardianName: form.get("guardianName"), guardianIdLast4: form.get("guardianIdLast4"), guardianConsent: form.get("guardianConsent") === "on" } });
        close();
        toast(created.sharedPhone ? "Patient saved. This phone matches another profile — they were not merged." : "Patient saved.");
        go(`patient/${created.patient.id}`);
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function patientBookForm(boot, preset) {
  const roster = (branchId) => boot.physios.filter((physio) => physio.branchId === branchId).map((physio) => ({ value: physio.id, label: `${physio.name} · ${physio.specialty}` }));
  const startValue = preset.start ? isoToLocalInput(preset.start) : defaultSlot();
  const lockedTime = Boolean(preset.start);
  openModal("Book visit", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Branch</label>${combo("branchId", boot.branches.map((branch) => ({ value: branch.id, label: `${branch.name} · ${branch.city || branch.hours}` })), preset.branchId || "")}</div>
      <div class="hw-field"><label class="hw-label">Physiotherapist</label>${combo("physioId", roster(preset.branchId), preset.physioId || "")}</div>
      <div class="hw-field"><label class="hw-label">Service</label>${combo("serviceId", boot.services.map((service) => ({ value: service.id, label: `${service.name} · ${service.kind === "CONSULT" ? "Consultation" : "Therapy"}` })))}</div>
      <div class="hw-field"><label class="hw-label">Slots</label>${durationField(boot.services, boot.services[0]?.id)}</div>
      <div class="hw-field"><label class="hw-label">Start (IST)</label><input class="hw-input" type="datetime-local" name="start" value="${startValue}" ${lockedTime ? "readonly" : ""} required></div>
      <p class="hw-muted">You can book another doctor or another branch after this visit is saved.</p>
      <button class="hw-btn hw-btn-primary" type="submit">Confirm booking</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("[data-name=branchId]").addEventListener("change", (event) => {
      const branchId = event.currentTarget.querySelector("input[type=hidden]").value;
      refillCombo(body.querySelector("[data-name=physioId]"), roster(branchId));
    });
    body.querySelector("[data-name=serviceId]")?.addEventListener("change", () => refillDuration(body, boot.services));
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api("/appointments", { method: "POST", key: crypto.randomUUID(), body: { branchId: form.branchId, physioId: form.physioId, serviceId: form.serviceId, durationMin: Number(form.durationMin), start: toIso(form.start), patientId: state.user.patientId } });
        state.portalBranch = form.branchId;
        state.portalPhysio = form.physioId;
        close();
        toast("Booked. Choose another doctor or branch if you need another visit.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

async function bookingForm(preset = {}) {
  const { boot, patients } = await optionsFor();
  const startValue = preset.start ? isoToLocalInput(preset.start) : defaultSlot();
  openModal("Book appointment", `
    <form class="hw-stack">
      <div class="hw-field"><label class="hw-label">Patient</label>${combo("patientId", patients.map((patient) => ({ value: patient.id, label: `${patient.name} · ${patient.code}` })), preset.patientId || "")}</div>
      <div class="hw-field"><label class="hw-label">Physiotherapist</label>${combo("physioId", boot.physios.filter((physio) => physio.branchId === state.branchId).map((physio) => ({ value: physio.id, label: `${physio.name} · ${physio.liveStatus}` })), preset.physioId || "")}</div>
      <div class="hw-field"><label class="hw-label">Service</label>${combo("serviceId", boot.services.map((service) => ({ value: service.id, label: `${service.name} · ${service.kind === "CONSULT" ? "Consultation" : "Therapy"} · ${inr(boot.prices[`${state.branchId}:${service.id}`])}` })))}</div>
      <div class="hw-field"><label class="hw-label">Slots</label>${durationField(boot.services, boot.services[0]?.id)}</div>
      <div class="hw-field"><label class="hw-label">Start (IST)</label><input class="hw-input" type="datetime-local" name="start" value="${startValue}" required></div>
      <button class="hw-btn hw-btn-primary" type="submit">Book</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("[data-name=serviceId]")?.addEventListener("change", () => refillDuration(body, boot.services));
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api("/appointments", { method: "POST", key: crypto.randomUUID(), body: { ...form, branchId: state.branchId, durationMin: Number(form.durationMin), start: toIso(form.start) } });
        close();
        toast("Appointment booked.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

async function walkInForm() {
  const { boot, patients } = await optionsFor();
  openModal("Walk-in", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Patient</label>${combo("patientId", patients.map((patient) => ({ value: patient.id, label: `${patient.name} · ${patient.code}` })))}</div><div class="hw-field"><label class="hw-label">Physiotherapist</label>${combo("physioId", boot.physios.filter((physio) => physio.branchId === state.branchId).map((physio) => ({ value: physio.id, label: physio.name })))}</div><div class="hw-field"><label class="hw-label">Service</label>${combo("serviceId", boot.services.map((service) => ({ value: service.id, label: `${service.name} · ${service.kind === "CONSULT" ? "Consultation" : "Therapy"}` })))}</div><div class="hw-field"><label class="hw-label">Slots</label>${durationField(boot.services, boot.services[0]?.id)}</div><button class="hw-btn hw-btn-primary" type="submit">Add to queue</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("[data-name=serviceId]")?.addEventListener("change", () => refillDuration(body, boot.services));
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api("/queue/walk-in", { method: "POST", body: { ...form, branchId: state.branchId, durationMin: Number(form.durationMin) } });
        close();
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function completeForm(id) {
  openModal("Complete session", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Clinical note</label><textarea class="hw-textarea" name="note" required placeholder="What was done and the home advice"></textarea></div><label class="hw-check"><input type="checkbox" name="usePackage"> Use one package credit</label><button class="hw-btn hw-btn-primary" type="submit">Complete visit</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        await api(`/visits/${id}/complete`, { method: "POST", body: { note: form.get("note"), usePackage: form.get("usePackage") === "on" } });
        close();
        toast("Visit completed.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function reasonAction(title, suffix, id, reasons) {
  openModal(title, `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Reason</label>${combo("reasonCode", reasons.map((reason) => ({ value: reason, label: reason.replaceAll("_", " ") })))}</div><button class="hw-btn hw-btn-danger" type="submit">Confirm</button></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api(`/appointments/${id}${suffix}`, { method: "POST", body: { reasonCode: new FormData(event.target).get("reasonCode") } });
        close();
        render();
      } catch (error) { toast(formError(error)); }
    };
  });
}

function transactionForm(id, current = "") {
  openModal("Transaction ID", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Transaction ID</label><input class="hw-input" name="transactionId" value="${esc(current)}" placeholder="Optional payment reference"></div><button class="hw-btn hw-btn-primary" type="submit">Save</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api(`/invoices/${id}`, { method: "PATCH", body: { transactionId: new FormData(event.target).get("transactionId") } });
        close();
        toast("Transaction ID saved.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function patientInvoiceForm(patient, timeline) {
  const sessions = (timeline || []).filter((row) => row.status === "COMPLETED" && !row.invoiceId);
  openModal("Add invoice", `<form class="hw-stack">
      <p class="hw-muted">${esc(patient.name)} · ${esc(patient.branchName)}. Charges come from the branch price of each completed session.</p>
      ${sessions.map((row) => `<label class="hw-check"><input type="checkbox" name="appointmentIds" value="${row.id}" checked> ${esc(when(row.start))} · ${esc(row.serviceName)} · ${esc(lengthLabel(row))} · ${esc(row.physioName)}</label>`).join("") || `<p>No completed session is waiting for an invoice.</p>`}
      <div class="hw-field"><label class="hw-label">Transaction ID</label><input class="hw-input" name="transactionId" placeholder="Optional"></div>
      <div class="hw-field"><label class="hw-label">Discount percent (max 10)</label><input class="hw-input" name="discount" type="number" min="0" max="10" value="0"></div>
      <button class="hw-btn hw-btn-primary" type="submit" ${sessions.length ? "" : "disabled"}>Post invoice</button><p class="hw-error" hidden></p>
    </form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const appointmentIds = form.getAll("appointmentIds");
      try {
        if (!appointmentIds.length) throw new Error("Choose at least one completed session.");
        await api("/invoices", { method: "POST", key: crypto.randomUUID(), body: { branchId: patient.branchId, patientId: patient.id, appointmentIds, transactionId: form.get("transactionId"), discountBps: Math.round(Number(form.get("discount") || 0) * 100) } });
        close();
        toast("Invoice posted on this profile.");
        state.patientTab = "billing";
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = error.message && !error.code ? error.message : formError(error);
      }
    };
  });
}

async function invoiceForm() {
  const { boot, patients } = await optionsFor();
  const appointments = await api(`/appointments?${branchQuery()}`);
  openModal("Post invoice", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Patient</label>${combo("patientId", patients.map((patient) => ({ value: patient.id, label: `${patient.name} · ${patient.code}` })))}</div><div class="hw-field"><label class="hw-label">Visit</label>${combo("appointmentId", [{ value: "", label: "No linked visit" }, ...appointments.appointments.filter((row) => !row.invoiceId && row.status === "COMPLETED").map((row) => ({ value: row.id, label: `${row.patientName} · ${when(row.start)}` }))])}</div><div class="hw-field"><label class="hw-label">Service</label>${combo("serviceId", boot.services.map((service) => ({ value: service.id, label: `${service.name} · ${inr(boot.prices[`${state.branchId}:${service.id}`])}` })))}</div><div class="hw-field"><label class="hw-label">Transaction ID</label><input class="hw-input" name="transactionId" placeholder="Optional payment reference"></div><div class="hw-field"><label class="hw-label">Discount percent (max 10)</label><input class="hw-input" name="discount" type="number" min="0" max="10" value="0"></div><button class="hw-btn hw-btn-primary" type="submit">Post invoice</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api("/invoices", { method: "POST", key: crypto.randomUUID(), body: { branchId: state.branchId, patientId: form.patientId, appointmentId: form.appointmentId || null, transactionId: form.transactionId, lines: [{ serviceId: form.serviceId, qty: 1 }], discountBps: Math.round(Number(form.discount || 0) * 100) } });
        close();
        toast("Invoice posted.");
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

async function paymentForm(id, due) {
  const boot = await api(`/bootstrap?${branchQuery()}`);
  const methods = (boot.paymentMethods || []).map((method) => ({ value: method.code, label: method.name }));
  openModal("Take payment", `<form class="hw-stack"><p class="hw-muted">Due ${inr(due)}. Enter rupees.</p><div class="hw-field"><label class="hw-label">Amount (₹)</label><input class="hw-input" name="rupees" type="number" min="0.01" step="0.01" value="${(due / 100).toFixed(2)}"></div><div class="hw-field"><label class="hw-label">Method</label>${combo("method", methods.length ? methods : [{ value: "CASH", label: "Cash" }])}</div><button class="hw-btn hw-btn-primary" type="submit">Record payment</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api(`/invoices/${id}/payments`, { method: "POST", key: crypto.randomUUID(), body: { amountPaise: Math.round(Number(form.rupees) * 100), method: form.method } });
        close();
        render();
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

function creditForm(id) {
  openModal("Credit note", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Reason</label><input class="hw-input" name="reason" required></div><button class="hw-btn hw-btn-danger" type="submit">Issue credit note</button></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      await api(`/invoices/${id}/credit-note`, { method: "POST", body: { reason: new FormData(event.target).get("reason") } });
      close();
      render();
    };
  });
}

function packageForm(catalog) {
  api(`/patients?q=&${branchQuery()}`).then((data) => {
    openModal("Sell package", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Patient</label>${combo("patientId", data.patients.map((patient) => ({ value: patient.id, label: patient.name })))}</div><div class="hw-field"><label class="hw-label">Package</label>${combo("packageId", catalog.map((pkg) => ({ value: pkg.id, label: `${pkg.name} · ${inr(pkg.pricePaise)}` })))}</div><button class="hw-btn hw-btn-primary" type="submit">Sell</button></form>`, (body, close) => {
      body.querySelector("form").onsubmit = async (event) => {
        event.preventDefault();
        const form = Object.fromEntries(new FormData(event.target));
        await api("/packages/purchase", { method: "POST", body: { ...form, branchId: state.branchId } });
        close();
        render();
      };
    });
  });
}

function feedbackForm(id) {
  openModal("Rate this visit", `<form class="hw-stack"><div class="hw-field"><label class="hw-label">Rating</label>${combo("rating", [5, 4, 3, 2, 1].map((rating) => ({ value: String(rating), label: String(rating) })))}</div><div class="hw-field"><label class="hw-label">Comment</label><textarea class="hw-textarea" name="comment"></textarea></div><button class="hw-btn hw-btn-primary" type="submit">Submit</button><p class="hw-error" hidden></p></form>`, (body, close) => {
    body.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      try {
        await api("/feedback", { method: "POST", body: { appointmentId: id, rating: Number(form.rating), comment: form.comment } });
        close();
        toast("Thank you. One rating is kept for this visit.");
      } catch (error) {
        const node = body.querySelector(".hw-error");
        node.hidden = false;
        node.textContent = formError(error);
      }
    };
  });
}

async function logout() {
  try { await api("/auth/logout", { method: "POST", body: {} }); } catch { /* session already gone */ }
  sessionStorage.removeItem("hw-token");
  sessionStorage.removeItem("hw-user");
  sessionStorage.removeItem("hw-board");
  state.token = "";
  state.user = null;
  $("#app").hidden = true;
  $("#login-screen").hidden = false;
}

function showError(node, error) {
  node.hidden = false;
  node.textContent = error.message;
}

function setupLogin() {
  const accounts = [
    ["leela.reception@healthwise.local", "Leela D'Souza", "Reception"],
    ["neha.kulkarni@healthwise.local", "Dr. Neha Kulkarni", "Physiotherapist"],
    ["arun.nair@healthwise.local", "Arun Nair", "Branch admin"],
    ["priya.shah@healthwise.local", "Priya Shah", "Org admin"],
  ];
  $("#demo-accounts").innerHTML = accounts.map(([email, name, role]) => `<button type="button" class="hw-demo-btn" data-email="${email}"><span><strong>${name}</strong><br><span class="hw-muted">${role}</span></span><span class="hw-muted">Use</span></button>`).join("");
  $("#demo-accounts").querySelectorAll("[data-email]").forEach((button) => button.onclick = () => { $("#email").value = button.dataset.email; $("#password").value = "HealthWise#2026"; });
  $("#tab-staff").onclick = () => { $("#staff-form").hidden = false; $("#patient-form").hidden = true; $("#tab-staff").className = "hw-btn hw-btn-primary"; $("#tab-patient").className = "hw-btn"; };
  $("#tab-patient").onclick = () => { $("#staff-form").hidden = true; $("#patient-form").hidden = false; $("#tab-patient").className = "hw-btn hw-btn-primary"; $("#tab-staff").className = "hw-btn"; };
  $("#staff-form").onsubmit = async (event) => {
    event.preventDefault();
    const error = $("#staff-error");
    error.hidden = true;
    try {
      if (!$("#mfa-field").hidden && $("#mfa").value) {
        const session = await api("/auth/mfa", { method: "POST", body: { challengeId: state.challengeId, code: $("#mfa").value } });
        return enter(session);
      }
      const challenge = await api("/auth/login", { method: "POST", body: { email: $("#email").value, password: $("#password").value } });
      state.challengeId = challenge.challengeId;
      $("#mfa-field").hidden = false;
      $("#mfa").focus();
    } catch (err) { showError(error, err); }
  };
  $("#patient-form").onsubmit = async (event) => {
    event.preventDefault();
    const error = $("#patient-error");
    error.hidden = true;
    try {
      if (!$("#otp-field").hidden && $("#otp").value) {
        const selected = document.querySelector("input[name=profile]:checked")?.value;
        const session = await api("/portal/otp/verify", { method: "POST", body: { challengeId: state.otpChallengeId, code: $("#otp").value, patientId: selected } });
        if (session.selectProfile) {
          $("#profile-picker").hidden = false;
          $("#profile-picker").innerHTML = `<p class="hw-banner">Which family profile are you?</p>` + session.profiles.map((profile, index) => `<label class="hw-check"><input type="radio" name="profile" value="${profile.id}" ${index === 0 ? "checked" : ""}> ${esc(profile.name)} · ${esc(profile.code)}</label>`).join("");
          return;
        }
        return enter(session);
      }
      const challenge = await api("/portal/otp/request", { method: "POST", body: { phone: $("#phone").value } });
      state.otpChallengeId = challenge.challengeId;
      $("#otp-field").hidden = false;
    } catch (err) { showError(error, err); }
  };
}

async function enter(session) {
  state.token = session.token;
  state.user = session.user;
  sessionStorage.setItem("hw-token", session.token);
  sessionStorage.setItem("hw-user", JSON.stringify(session.user));
  if (!state.branchId) state.branchId = session.user.branchIds?.[0] || "br-kor";
  sessionStorage.setItem("hw-branch", state.branchId);
  setShell();
  await loadBranches();
  if (!location.hash) location.hash = state.user.role === "PATIENT" ? "#/book" : "#/today";
  await render();
}

async function init() {
  setupLogin();
  $("#logout-btn").onclick = logout;
  $("#sidebar-toggle").onclick = () => document.body.classList.toggle("hw-sidebar-open");
  $("#hw-overlay").onclick = () => document.body.classList.remove("hw-sidebar-open");
  syncThemeIcon();
  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("clinexa-theme", dark ? "dark" : "light");
    syncThemeIcon();
  };
  $("#theme-toggle").onclick = toggleTheme;
  $("#login-theme").onclick = toggleTheme;
  document.addEventListener("click", (event) => {
    document.querySelectorAll("[data-combo]").forEach((wrap) => {
      if (!wrap.contains(event.target)) wrap.querySelector(".hw-combo-list").hidden = true;
    });
  });
  $("#global-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      if (location.hash === "#/patients") render();
      else go("patients");
    }
  });
  window.addEventListener("hashchange", () => { if (state.user) render(); });
  window.addEventListener("offline", () => {
    state.offline = true;
    $("#online-badge").className = "hw-chip is-bad";
    $("#online-badge").textContent = "Offline";
  });
  if (!state.token) return;
  try {
    const me = await api("/me");
    state.user = me.user;
    if (!state.branchId && me.user.branchIds?.length) state.branchId = me.user.branchIds[0];
    setShell();
    await loadBranches();
    if (!location.hash) location.hash = state.user.role === "PATIENT" ? "#/book" : "#/today";
    else await render();
  } catch {
    sessionStorage.removeItem("hw-token");
    sessionStorage.removeItem("hw-user");
    state.token = "";
  }
}

init();
