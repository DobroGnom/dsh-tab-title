window.__ModuleLoader__.load({ id: "dsh-tab-title", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  resolvePendingInteractions: () => resolvePendingInteractions
});
module.exports = __toCommonJS(client_exports);

// src/title-guard.ts
var TARGET = "DeepSeek Harness";
function pinDocumentTitle(doc, getTarget) {
  const enforce = () => {
    const target = getTarget();
    if (doc.title !== target) doc.title = target;
  };
  enforce();
  const titleElement = () => doc.head.querySelector("title");
  const observers = [];
  const title = titleElement();
  if (title !== null) {
    const titleObserver = new MutationObserver(enforce);
    titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
    observers.push(titleObserver);
  } else {
    let titleObserver;
    const headObserver = new MutationObserver(() => {
      const lateTitle = titleElement();
      if (lateTitle === null || titleObserver !== void 0) return;
      titleObserver = new MutationObserver(enforce);
      titleObserver.observe(lateTitle, { childList: true, characterData: true, subtree: true });
      observers.push(titleObserver);
      enforce();
    });
    headObserver.observe(doc.head, { childList: true });
    observers.push(headObserver);
  }
  return {
    refresh: enforce,
    dispose() {
      for (const observer of observers) observer.disconnect();
      observers.length = 0;
    }
  };
}

// src/tab-alert.ts
var ALERT_TITLE = `\u2713 ${TARGET}`;
var ATTENTION_TITLE = `\u2753 ${TARGET}`;
var BURST_INTERVAL_MS = 1e3;
var BURST_DURATION_MS = 6e3;
function installTitleController(doc, sessions, pendingInteractions) {
  let marker;
  let burstTimer;
  let settleTimer;
  let disposeGuard;
  const stopBurst = () => {
    if (burstTimer !== void 0) clearInterval(burstTimer);
    if (settleTimer !== void 0) clearTimeout(settleTimer);
    burstTimer = void 0;
    settleTimer = void 0;
  };
  const currentTarget = () => marker === void 0 ? TARGET : `${marker} ${TARGET}`;
  const guard = pinDocumentTitle(doc, currentTarget);
  disposeGuard = () => {
    guard.dispose();
    disposeGuard = void 0;
  };
  const disarm = () => {
    stopBurst();
    if (marker === void 0) return;
    marker = void 0;
    guard.refresh();
  };
  const arm = (withMarker) => {
    marker = withMarker;
    guard.refresh();
    let tick = 0;
    burstTimer = setInterval(() => {
      tick += 1;
      if (tick % 2 === 0) guard.refresh();
      else doc.title = TARGET;
    }, BURST_INTERVAL_MS);
    settleTimer = setTimeout(() => {
      stopBurst();
      marker = withMarker;
      guard.refresh();
    }, BURST_DURATION_MS);
  };
  let previousRunning = new Map(
    Object.entries(sessions.getSnapshot().byId).map(([id, row]) => [id, row.running])
  );
  const unsubscribeSessions = sessions.subscribe(() => {
    const byId = sessions.getSnapshot().byId;
    for (const [id, row] of Object.entries(byId)) {
      const was = previousRunning.get(id);
      const is = row.running;
      if (is === true) {
        disarm();
      } else if (was === true && is === false && doc.hidden && marker !== "\u2753") {
        arm("\u2713");
      }
    }
    previousRunning = new Map(Object.entries(byId).map(([id, row]) => [id, row.running]));
  });
  let previousPending = pendingKeys(pendingInteractions.getSnapshot());
  const unsubscribePending = pendingInteractions.subscribe(() => {
    const current = pendingInteractions.getSnapshot();
    const currentKeys = pendingKeys(current);
    let hasNew = currentKeys.size > previousPending.size;
    if (!hasNew) {
      for (const [id, key] of currentKeys) {
        if (previousPending.get(id) !== key) {
          hasNew = true;
          break;
        }
      }
    }
    previousPending = currentKeys;
    if (hasNew && doc.hidden) arm("\u2753");
  });
  const onVisibility = () => {
    if (!doc.hidden) disarm();
  };
  doc.addEventListener("visibilitychange", onVisibility);
  return {
    dispose() {
      unsubscribeSessions();
      unsubscribePending();
      doc.removeEventListener("visibilitychange", onVisibility);
      stopBurst();
      marker = void 0;
      disposeGuard?.();
    }
  };
}
function pendingKeys(snapshot) {
  return new Map([...snapshot.entries()].map(([id, interaction]) => [id, interaction.key ?? interaction]));
}

// src/client.ts
var inject = ["sessions", "uiSession"];
function resolvePendingInteractions(uiSession) {
  if (uiSession.pendingInteractions !== void 0) return uiSession.pendingInteractions;
  if (uiSession.sessionStatus !== void 0) {
    return {
      getSnapshot: () => new Map(
        [...uiSession.sessionStatus.getSnapshot().entries()].flatMap(([id, status]) => status.pendingInteraction === void 0 ? [] : [[id, status.pendingInteraction]])
      ),
      subscribe: (listener) => uiSession.sessionStatus.subscribe(listener)
    };
  }
  throw new Error("dsh-tab-title: uiSession exposes no pending-interaction feed");
}
function apply(ctx) {
  ctx.effect(() => {
    const controller = installTitleController(
      document,
      ctx.sessions.list,
      resolvePendingInteractions(ctx.uiSession)
    );
    return () => controller.dispose();
  }, "tab-title: guard + completion/attention alerts");
}
return module.exports; } });
//# sourceMappingURL=client.js.map
