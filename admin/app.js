"use strict";
// All report data and the access token remain in memory. No game or user IDs are stored.
const DEFAULT_CLIENT_ID = "755808518263-cbhrcuhubp42g1s71i1dgm7kr1aav27c.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const Attribution = window.UBRAttribution;
const ENDPOINT = "https://analyticsdata.googleapis.com";
const number = new Intl.NumberFormat("ko-KR");
const $ = (id) => document.getElementById(id);
const state = {
  token: null,
  expiry: 0,
  generation: 0,
  controller: null,
  expiryTimer: null,
  quality: new Set(),
  reportTimeZone: "UTC",
  config: readConfig(),
};
const funnelSteps = [
  ["첫 실행", "first_open"],
  ["게임 진입", "game_ready"],
  ["튜토리얼 시작", "tutorial_start"],
  ["보스 도전", "boss_started"],
  ["보스 처치", "boss_won"],
];
const labels = {
  manual: "직접 중단",
  bag_full: "가방 가득 참",
  low_hp: "체력 부족",
  defeat: "전투 패배",
  save_error: "저장 오류",
  other: "기타",
  boss: "일반 보스",
  final: "최종 보스",
  equip: "장착",
  sell: "판매",
  keep: "보관",
  revive: "부활",
  gold: "골드",
  double_gold: "보스 골드 두 배",
  potion: "회복약",
  luck: "행운",
  str: "공격 강화",
  vit: "체력 강화",
  spd: "공격 속도 강화",
  bag: "가방 강화",
  buy_potion: "회복약 구매",
  drink_auto: "회복약 자동 사용",
  drink_manual: "회복약 직접 사용",
  meta_str: "유물 공격 강화",
  meta_vit: "유물 체력 강화",
  meta_gold: "유물 골드 강화",
  meta_luck: "유물 행운 강화",
  meta_potion: "유물 회복약 강화",
  meta_bag: "유물 가방 강화",
  meta_dust_aff: "유물 가루 강화",
};
function readConfig() {
  try {
    const c = JSON.parse(
      localStorage.getItem("ubr-dashboard-settings") || "{}",
    );
    return {
      clientId: typeof c.clientId === "string" && /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(c.clientId) ? c.clientId : DEFAULT_CLIENT_ID,
      propertyId: /^\d+$/.test(c.propertyId || "") ? c.propertyId : "561781670",
    };
  } catch {
    return { clientId: DEFAULT_CLIENT_ID, propertyId: "561781670" };
  }
}
function notify(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => t.classList.remove("visible"), 6500);
}
function elem(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
}
function setStatus(text, on = false) {
  $("status-text").textContent = text;
  $("status-dot").classList.toggle("on", on);
}
function clearNode(node) {
  node.replaceChildren();
}
function message(id, msg, error = false) {
  const node = $(id);
  node.className = "placeholder";
  clearNode(node);
  node.append(elem("span", error ? "!" : "◌"), elem("p", msg));
}
function errorText(error) {
  if (error.status === 401) return "인증이 만료되었습니다. 다시 연결해 주세요.";
  if (error.status === 403)
    return "API 사용 설정 또는 이 계정의 Analytics 접근 권한을 확인해 주세요.";
  if (error.status === 400) return `조회 설정 확인 필요: ${error.message}`;
  if (error.status === 429)
    return "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  return "이 항목을 불러오지 못했습니다. API 설정과 맞춤 측정항목을 확인해 주세요.";
}
function setLoading() {
  for (const id of [
    "active-users",
    "new-users",
    "boss-attempts",
    "rewards-earned",
  ])
    $(id).textContent = "—";
  for (const id of [
    "funnel",
    "ads-list",
    "retention",
    "trend",
    "stops",
    "loot",
    "ad-types",
    "economy",
  ])
    message(id, "데이터를 불러오는 중입니다.");
  const table = $("boss-table");
  clearNode(table);
  const tr = elem("tr"),
    td = elem("td", "데이터를 불러오는 중입니다.", "empty");
  td.colSpan = 6;
  tr.append(td);
  table.append(tr);
  acquisitionMessage("데이터를 불러오는 중입니다.");
}
function reportFilter() {
  return Attribution.audienceFilter({
    country: $("country").value,
    meta: $("acquisition").value === "meta",
    campaign: $("campaign").value,
    ad: $("ad").value,
  });
}
function eventFilter(names) {
  return {
    filter: { fieldName: "eventName", inListFilter: { values: names } },
  };
}
function combine(...filters) {
  const valid = filters.filter(Boolean);
  return valid.length === 1
    ? valid[0]
    : valid.length
      ? { andGroup: { expressions: valid } }
      : undefined;
}
function requestBody(dimensions, metrics, filters) {
  const body = {
    dateRanges: [{ startDate: $("period").value, endDate: "today" }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit: "10000",
  };
  if (filters) body.dimensionFilter = filters;
  return body;
}
async function api(method, body, version = "v1beta") {
  const generation = state.generation;
  const controller = state.controller;
  const response = await fetch(
    `${ENDPOINT}/${version}/properties/${state.config.propertyId}:${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
      cache: "no-store",
      referrerPolicy: "no-referrer",
    },
  );
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (generation !== state.generation || controller?.signal.aborted || !state.token) {
    throw new DOMException("조회가 취소되었습니다.", "AbortError");
  }
  if (!response.ok) {
    const e = new Error(data.error?.message || "Request failed");
    e.status = response.status;
    throw e;
  }
  for (const part of [data, data.funnelVisualization, data.funnelTable]) {
    if (!part) continue;
    const metadata = part.metadata || {};
    if (metadata.subjectToThresholding)
      state.quality.add("데이터가 개인정보 보호 기준에 따라 제한됨");
    if (metadata.dataLossFromOtherRow)
      state.quality.add("일부 항목이 기타로 묶임");
    if (metadata.samplingMetadatas?.length)
      state.quality.add("표본 데이터가 포함됨");
    if (Number(part.rowCount || 0) > (part.rows || []).length)
      state.quality.add("일부 행만 표시됨");
  }
  return data;
}
function rows(data) {
  return (data.rows || []).map((row) => ({
    d: (row.dimensionValues || []).map((v) => v.value),
    m: (row.metricValues || []).map((v) => Number(v.value)),
  }));
}
function pct(n, d) {
  return d > 0 ? `${((n * 100) / d).toFixed(1)}%` : "—";
}
function renderBars(id, items) {
  if (!items.length) {
    message(id, "선택한 기간에 데이터가 없습니다.");
    return;
  }
  const node = $(id);
  node.className = "bars";
  clearNode(node);
  const max = Math.max(...items.map((i) => i.value), 1);
  for (const item of items) {
    const row = elem("div", undefined, "bar-row"),
      track = elem("div", undefined, "track"),
      fill = elem("div", undefined, "fill");
    fill.style.width = `${Math.max(0, Math.min(100, (item.value / max) * 100))}%`;
    track.append(fill);
    row.append(
      elem("span", item.label),
      track,
      elem("b", item.display ?? number.format(item.value)),
    );
    node.append(row);
  }
}
function renderList(id, items, kind = "ad-row") {
  if (!items.length) {
    message(id, "선택한 기간에 데이터가 없습니다.");
    return;
  }
  const node = $(id);
  node.className = "list-body";
  clearNode(node);
  for (const item of items) {
    const row = elem("div", undefined, kind);
    row.append(
      elem("span", item.label),
      elem("b", item.display ?? number.format(item.value)),
    );
    node.append(row);
  }
}
function showTableMessage(text) {
  const table = $("boss-table");
  clearNode(table);
  const row = elem("tr"),
    cell = elem("td", text, "empty");
  cell.colSpan = 6;
  row.append(cell);
  table.append(row);
}
function acquisitionMessage(text) {
  const table = $("acquisition-table");
  clearNode(table);
  const row = elem("tr"), cell = elem("td", text, "empty");
  cell.colSpan = 10;
  row.append(cell);
  table.append(row);
}
function options(id, values, label) {
  const selected = $(id).value;
  clearNode($(id));
  const all = elem("option", label);
  all.value = "";
  $(id).append(all);
  const choices = new Set(values);
  if (selected) choices.add(selected);
  for (const value of [...choices].sort()) {
    const option = elem("option", value === "(not set)" ? "미확인 ID" : value);
    option.value = value;
    $(id).append(option);
  }
  $(id).value = selected;
}
async function loadAcquisition() {
  const generation = state.generation;
  const data = await api("runReport", Attribution.acquisitionBody({
    period: $("period").value, country: $("country").value, timeZone: state.reportTimeZone,
  }));
  if (generation !== state.generation || !state.token) return;
  const all = Attribution.aggregate(data);
  options("campaign", all.map(row => row.ids[1]), "전체 캠페인");
  options("ad", all.filter(row => !$("campaign").value || row.ids[1] === $("campaign").value).map(row => row.ids[3]), "전체 광고");
  const selected = all.filter(row => (!$("campaign").value || row.ids[1] === $("campaign").value) && (!$("ad").value || row.ids[3] === $("ad").value));
  if (!selected.length) {
    acquisitionMessage("선택한 기간에 확인된 메타 광고 유입이 없습니다. 연결 전·귀속 미확인·실제 유입 없음은 이 화면만으로 구분할 수 없습니다.");
    return;
  }
  clearNode($("acquisition-table"));
  for (const item of selected) {
    const tr = elem("tr");
    for (const value of [...item.ids.map(id => !id || id === "(not set)" ? "미확인" : id), ...Attribution.EVENTS.map(event => number.format(item.counts[event]))]) {
      tr.append(elem("td", value));
    }
    $("acquisition-table").append(tr);
  }
}
async function loadSummary() {
  const d = await api(
    "runReport",
    requestBody([], ["activeUsers", "newUsers"], reportFilter()),
  );
  state.reportTimeZone = d.metadata?.timeZone || "UTC";
  const r = rows(d);
  $("active-users").textContent = r.length ? number.format(r[0].m[0]) : "—";
  $("new-users").textContent = r.length ? number.format(r[0].m[1]) : "—";
}
async function loadEvents() {
  const names = [
    "boss_started",
    "reward_requested",
    "reward_shown",
    "reward_earned",
    "reward_saved",
    "reward_failed",
  ];
  const d = await api(
    "runReport",
    requestBody(
      ["eventName"],
      ["eventCount"],
      combine(reportFilter(), eventFilter(names)),
    ),
  );
  const r = rows(d),
    counts = Object.fromEntries(r.map((x) => [x.d[0], x.m[0]]));
  $("boss-attempts").textContent = r.length
    ? number.format(counts.boss_started || 0)
    : "—";
  $("rewards-earned").textContent = r.length
    ? number.format(counts.reward_earned || 0)
    : "—";
  renderList(
    "ads-list",
    r.length
      ? [
          ["요청", "reward_requested"],
          ["표시", "reward_shown"],
          ["보상 획득", "reward_earned"],
          ["보상 저장 결과", "reward_saved"],
          ["실패", "reward_failed"],
        ].map(([label, key]) => ({ label, value: counts[key] || 0 }))
      : [],
  );
}
async function loadFunnel() {
  const body = {
    dateRanges: [{ startDate: $("period").value, endDate: "today" }],
    funnel: {
      isOpenFunnel: false,
      steps: funnelSteps.map(([name, eventName]) => ({
        name,
        filterExpression: { funnelEventFilter: { eventName } },
      })),
    },
  };
  const country = reportFilter();
  if (country) body.dimensionFilter = country;
  const data = await api("runFunnelReport", body, "v1alpha");
  const r = rows(data.funnelVisualization || {});
  const first = r[0]?.m[0] || 0;
  renderBars(
    "funnel",
    r.map((x) => ({
      label: x.d[0].replace(/^\d+\.\s*/, ""),
      value: x.m[0],
      display: `${number.format(x.m[0])}명 · ${pct(x.m[0], first)}`,
    })),
  );
}
async function loadBoss() {
  const d = await api(
    "runReport",
    requestBody(
      ["customEvent:area", "customEvent:cycle", "customEvent:event_context"],
      ["eventCount", "customEvent:amount"],
      combine(reportFilter(), eventFilter(["boss_result"])),
    ),
  );
  const r = rows(d);
  if (!r.length) {
    showTableMessage("선택한 기간에 저장된 보스 결과가 없습니다.");
    return;
  }
  const table = $("boss-table");
  clearNode(table);
  for (const x of r) {
    const [area, cycle, kind] = x.d,
      [count, wins] = x.m;
    const row = elem("tr");
    for (const value of [
      Number.isFinite(Number(area)) ? String(Number(area) + 1) : area,
      cycle,
      labels[kind] || kind,
      number.format(count),
      number.format(wins),
      pct(wins, count),
    ])
      row.append(elem("td", value));
    table.append(row);
  }
}
async function loadStops() {
  const d = await api(
    "runReport",
    requestBody(
      ["customEvent:event_context"],
      ["eventCount"],
      combine(reportFilter(), eventFilter(["auto_stopped"])),
    ),
  );
  renderBars(
    "stops",
    rows(d).map((x) => ({ label: labels[x.d[0]] || x.d[0], value: x.m[0] })),
  );
}
async function loadCategorized(id, eventName) {
  const d = await api(
    "runReport",
    requestBody(
      ["customEvent:event_context"],
      ["eventCount"],
      combine(reportFilter(), eventFilter([eventName])),
    ),
  );
  renderBars(
    id,
    rows(d).map((x) => ({ label: labels[x.d[0]] || x.d[0], value: x.m[0] })),
  );
}
async function loadTrend() {
  const body = requestBody(["date"], ["activeUsers"], reportFilter());
  body.orderBys = [{ dimension: { dimensionName: "date" } }];
  const d = await api("runReport", body);
  const r = rows(d);
  if (!r.length) {
    message("trend", "선택한 기간에 데이터가 없습니다.");
    return;
  }
  const n = $("trend");
  n.className = "trend";
  clearNode(n);
  const max = Math.max(...r.map((x) => x.m[0]), 1);
  for (const x of r) {
    const bar = elem("div", undefined, "trend-bar");
    bar.style.height = `${Math.max(2, (x.m[0] / max) * 100)}%`;
    bar.title = `${x.d[0]} · ${number.format(x.m[0])}명`;
    n.append(bar);
  }
}
function propertyDateDaysAgo(days, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: state.reportTimeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - days)).toISOString().slice(0, 10);
}
async function loadRetention() {
  const body = {
    dimensions: [{ name: "cohort" }, { name: "cohortNthDay" }],
    metrics: [{ name: "cohortActiveUsers" }, { name: "cohortTotalUsers" }],
    cohortSpec: {
      cohorts: [
        {
          name: "최근 신규 사용자",
          dimension: "firstSessionDate",
          dateRange: { startDate: propertyDateDaysAgo(35), endDate: propertyDateDaysAgo(8) },
        },
      ],
      cohortsRange: { endOffset: 7, granularity: "DAILY" },
    },
  };
  const d = await api("runReport", body);
  const r = rows(d);
  if (!r.length) {
    message("retention", "아직 코호트 데이터가 없습니다.");
    return;
  }
  const items = [1, 7].map((day) => {
    const v = r.find((x) => Number(x.d[1]) === day);
    return {
      label: `${day}일 후 재방문`,
      display: v ? pct(v.m[0], v.m[1]) : "—",
    };
  });
  renderList("retention", items, "retention-row");
}
async function refresh() {
  if (!state.token || Date.now() >= state.expiry) {
    disconnect();
    notify("Google 연결이 만료되었습니다. 다시 연결해 주세요.");
    return;
  }
  state.controller?.abort();
  state.controller = new AbortController();
  const generation = ++state.generation;
  state.quality.clear();
  $("quality-note").classList.add("hidden");
  setLoading();
  setStatus("데이터 불러오는 중");
  $("refresh-btn").disabled = true;
  const tasks = [
    ["요약", loadSummary],
    ["광고별 유입", loadAcquisition],
    ["광고", loadEvents],
    ["퍼널", loadFunnel],
    ["보스", loadBoss],
    ["중단 사유", loadStops],
    ["일별 플레이", loadTrend],
    ["재방문", loadRetention],
    ["보상 선택", () => loadCategorized("loot", "boss_loot_action")],
    ["광고 종류", () => loadCategorized("ad-types", "reward_earned")],
    ["성장 행동", () => loadCategorized("economy", "economy_action")],
  ];
  const errors = [];
  for (const [name, fn] of tasks) {
    if (generation !== state.generation) return;
    try {
      await fn();
      if (generation !== state.generation) return;
      if (name === "요약") {
        $("private-content").hidden = false;
        document.body.classList.add("analytics-visible");
        $("welcome").classList.add("hidden");
      }
    } catch (e) {
      if (generation !== state.generation) return;
      if (name === "요약") {
        disconnect();
        notify(errorText(e));
        return;
      }
      errors.push(name);
      if (name === "광고별 유입") acquisitionMessage(errorText(e));
      else if (name === "퍼널") message("funnel", errorText(e), true);
      else if (name === "광고") message("ads-list", errorText(e), true);
      else if (name === "보스") showTableMessage(errorText(e));
      else if (name === "중단 사유") message("stops", errorText(e), true);
      else if (name === "일별 플레이") message("trend", errorText(e), true);
      else if (name === "재방문") message("retention", errorText(e), true);
      else if (name === "보상 선택") message("loot", errorText(e), true);
      else if (name === "광고 종류") message("ad-types", errorText(e), true);
      else if (name === "성장 행동") message("economy", errorText(e), true);
      if (e.status === 401) {
        disconnect();
        notify(errorText(e));
        return;
      }
    }
  }
  if (generation !== state.generation) return;
  $("refresh-btn").disabled = false;
  $("welcome").classList.add("hidden");
  if (state.quality.size) {
    $("quality-note").textContent =
      `Google Analytics 집계 안내: ${[...state.quality].join(" · ")}. 수치를 해석할 때 참고해 주세요.`;
    $("quality-note").classList.remove("hidden");
  }
  setStatus(
    errors.length || state.quality.size ? "일부 항목 확인 필요" : "연결됨",
    true,
  );
  $("updated").textContent = `${new Date().toLocaleString("ko-KR")} 업데이트`;
  if (errors.length) notify(`${errors.join(", ")} 항목을 불러오지 못했습니다.`);
}
function connect() {
  if (!state.config.clientId) {
    $("settings").showModal();
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    notify(
      "Google 로그인 라이브러리를 불러오지 못했습니다. 네트워크나 차단 설정을 확인해 주세요.",
    );
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: state.config.clientId,
    scope: SCOPE,
    login_hint: "v8redline.studio@gmail.com",
    callback: (response) => {
      if (response.error || !response.access_token) {
        notify("Google 연결이 취소되었거나 실패했습니다.");
        return;
      }
      state.token = response.access_token;
      state.expiry =
        Date.now() +
        Math.max(0, (Number(response.expires_in) || 0) - 60) * 1000;
      clearTimeout(state.expiryTimer);
      state.expiryTimer = setTimeout(
        () => {
          disconnect();
          notify("Google 연결이 만료되었습니다. 다시 연결해 주세요.");
        },
        Math.max(0, state.expiry - Date.now()),
      );
      $("login-btn").classList.add("hidden");
      $("logout-btn").classList.remove("hidden");
      refresh();
    },
    error_callback: () =>
      notify("Google 연결 창을 열지 못했거나 사용자가 닫았습니다."),
  });
  client.requestAccessToken();
}
function disconnect() {
  state.token = null;
  state.expiry = 0;
  clearTimeout(state.expiryTimer);
  state.expiryTimer = null;
  $("private-content").hidden = true;
  document.body.classList.remove("analytics-visible");
  state.generation++;
  state.controller?.abort();
  state.controller = null;
  $("login-btn").classList.remove("hidden");
  $("logout-btn").classList.add("hidden");
  $("refresh-btn").disabled = true;
  $("welcome").classList.remove("hidden");
  $("quality-note").classList.add("hidden");
  state.quality.clear();
  setStatus("연결 전");
  $("updated").textContent = "데이터를 불러오지 않았어요";
  for (const id of [
    "active-users",
    "new-users",
    "boss-attempts",
    "rewards-earned",
  ])
    $(id).textContent = "—";
  for (const id of [
    "funnel",
    "ads-list",
    "retention",
    "trend",
    "stops",
    "loot",
    "ad-types",
    "economy",
  ])
    message(id, "연결 후 데이터를 확인할 수 있어요.");
  showTableMessage("연결 후 보스 기록이 표시됩니다.");
  acquisitionMessage("연결 후 광고별 기록이 표시됩니다.");
  for (const id of ["campaign", "ad"]) {
    $(id).value = "";
    options(id, [], id === "campaign" ? "전체 캠페인" : "전체 광고");
  }
  $("acquisition").value = "";
}
$("settings-btn").addEventListener("click", () => {
  $("client-id").value = state.config.clientId;
  $("property-id").value = state.config.propertyId;
  $("settings").showModal();
});
$("login-btn").addEventListener("click", connect);
$("welcome-connect").addEventListener("click", connect);
$("logout-btn").addEventListener("click", disconnect);
$("refresh-btn").addEventListener("click", refresh);
for (const id of ["period", "country", "acquisition", "campaign", "ad"])
  $(id).addEventListener("change", () => {
    if (id === "acquisition" && !$(id).value) {
      $("campaign").value = "";
      $("ad").value = "";
    }
    if (id === "campaign") $("ad").value = "";
    if ((id === "campaign" || id === "ad") && $(id).value) $("acquisition").value = "meta";
    if (state.token) refresh();
  });
$("save-settings").addEventListener("click", (e) => {
  const clientId = $("client-id").value.trim(),
    propertyId = $("property-id").value.trim();
  if (
    !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) ||
    !/^\d+$/.test(propertyId)
  ) {
    e.preventDefault();
    $("settings-error").textContent =
      "올바른 OAuth 클라이언트 ID와 숫자 속성 ID를 입력해 주세요.";
    return;
  }
  $("settings-error").textContent = "";
  disconnect();
  state.config = { clientId, propertyId };
  localStorage.setItem("ubr-dashboard-settings", JSON.stringify(state.config));
  notify("설정을 저장했습니다. Google로 연결해 주세요.");
});
$("client-id").value = state.config.clientId;
$("property-id").value = state.config.propertyId;

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.token && Date.now() >= state.expiry) {
    disconnect();
    notify("Google 연결이 만료되었습니다. 다시 연결해 주세요.");
  }
});

$("build-link").addEventListener("click", () => {
  try {
    $("play-link").value = Attribution.playUrl($("link-campaign").value.trim(), $("link-adset").value.trim(), $("link-ad").value.trim());
    $("link-message").textContent = "링크를 만들었습니다. 메타 광고 설정과 신규 설치 귀속 검증이 별도로 필요합니다.";
  } catch (e) {
    $("play-link").value = "";
    $("link-message").textContent = e.message;
  }
});
