// The same lifecycle owns the sign-in, Home and gameplay frame callbacks.
const instances = new WeakMap();

export function gameLifecycle(win = window, doc = win.document) {
 if (instances.has(win)) return instances.get(win);
 const loops = new Map(), listeners = new Set(), captures = new Map(), pointers = new Map();
 const recent = [];
 let visible = !doc.hidden, background = doc.hidden, frozen = false, blurred = false;
 let watchdog = null, loopRestarts = 0, droppedPointers = 0;
 const now = () => win.performance.now();
 const record = (event, detail = '') => {
  recent.push({time: new Date().toISOString(), event, detail});
  if (recent.length > 24) recent.shift();
 };
 const active = () => visible && !doc.hidden && !background && !frozen && !blurred;
 const invoke = (callback, ...args) => {
  try { callback(...args) } catch (error) {
   const detail = String(error?.message || error);
   if (recent.at(-1)?.detail !== detail) record('error', detail);
  }
 };
 doc.addEventListener('pointerdown', event => {
  pointers.set(event.pointerId, {target:event.target,type:event.pointerType});
 }, true);
 const endPointer = event => pointers.delete(event.pointerId);
 doc.addEventListener('pointerup', endPointer, true);
 doc.addEventListener('pointercancel', endPointer, true);
 doc.addEventListener('gotpointercapture', event => captures.set(event.pointerId, event.target), true);
 doc.addEventListener('lostpointercapture', event => {
  if (captures.get(event.pointerId) === event.target) captures.delete(event.pointerId);
 }, true);
 function releasePointers() {
  const held = new Map(captures), pending = [...pointers];
  captures.clear();
  pointers.clear();
  for (const [pointerId, {target,type}] of pending) {
   if (!win.PointerEvent || !target.isConnected) continue;
   const owner = held.get(pointerId) || target;
   invoke(() => owner.dispatchEvent(new win.PointerEvent('pointercancel', {
    pointerId, pointerType:type, bubbles:true
   })));
  }
  for (const [id, element] of held) {
   if (element.hasPointerCapture?.(id)) {
    invoke(() => element.releasePointerCapture(id));
    droppedPointers++;
   }
  }
 }
 function checkOverlays() {
  // These shields belong exclusively to visual transitions. Modal dialogs,
  // landscape prompts, and account gates retain their own input policy.
  for (const node of doc.querySelectorAll('[data-recovery-fade]')) {
   if (node.hidden || node.style.pointerEvents === 'none') continue;
   const style = win.getComputedStyle?.(node);
   if (style && Number(style.opacity) <= .01 && !(node.getAnimations?.({subtree:true}) || []).some(animation => animation.playState === 'running')) {
    node.style.pointerEvents = 'none';
    record('transparent shield released', node.id || node.className);
   }
  }
 }
 function reconcile(event, recheck = false) {
  const wasActive = activeState;
  activeState = active();
  if (wasActive === activeState && !(activeState && recheck)) return;
  record(activeState ? 'resume' : 'suspend', event);
  if (!activeState) {
   for (const loop of loops.values()) loop.stop();
   win.clearInterval(watchdog);
   watchdog = null;
  }
  for (const listener of listeners) invoke(listener, activeState, event);
  releasePointers();
  if (activeState) {
   checkOverlays();
   for (const loop of loops.values()) loop.start();
   watch();
  }
 }
 function watch() {
  if (watchdog !== null || !active() || !loops.size) return;
  watchdog = win.setInterval(() => {
   if (!active()) return;
   checkOverlays();
   let recovering = false;
   for (const [name, loop] of loops) {
    if (loop.stalled()) {
     loopRestarts++;
     record('frame loop recovered', name);
     loop.stop();
     recovering = true;
    }
   }
   if (recovering) reconcile('frame watchdog', true);
  }, 2000);
  watchdog?.unref?.();
 }
 let activeState = active();
 doc.addEventListener('visibilitychange', () => {
  visible = !doc.hidden;
  if (visible) { background = false; blurred = false; }
  reconcile('visibilitychange');
 });
 win.addEventListener('blur', () => { blurred = true; reconcile('blur'); });
 win.addEventListener('focus', () => {
  visible = !doc.hidden;
  if (visible) { blurred = background = frozen = false; }
  reconcile('focus');
 });
 win.addEventListener('pagehide', () => { background = true; reconcile('pagehide'); });
 win.addEventListener('pageshow', () => {
  visible = !doc.hidden; background = frozen = blurred = false;
  reconcile('pageshow', true);
 });
 doc.addEventListener('freeze', () => { frozen = true; reconcile('freeze'); });
 doc.addEventListener('resume', () => {
  frozen = background = blurred = false; visible = !doc.hidden;
  reconcile('resume');
 });
 doc.addEventListener('webglcontextlost', event => record('WebGL context lost', event.target.id || event.target.className), true);
 doc.addEventListener('webglcontextrestored', event => record('WebGL context restored', event.target.id || event.target.className), true);
 const api = {
  active, record,
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  frameLoop(name, frame, reset = () => {}) {
   loops.get(name)?.dispose();
   let id = null, generation = 0, wanted = false, last = 0;
   const run = () => {
    if (id !== null || !wanted || !active()) return;
    const token = generation;
    id = win.requestAnimationFrame(function frameTick(time) {
     if (token !== generation) return;
     id = null;
     if (!wanted || !active()) return;
     last = now();
     try { invoke(frame, time); } finally { run(); }
    });
   };
   const loop = {
    start() { if (!wanted || id !== null || !active()) return; last = now(); invoke(reset); run(); },
    stop() { generation++; if (id !== null) win.cancelAnimationFrame(id); id = null; },
    stalled() { return wanted && now() - last > 5000; },
    dispose() {
     wanted = false; loop.stop(); loops.delete(name);
     if (!loops.size) { win.clearInterval(watchdog); watchdog = null; }
    }
   };
   loops.set(name, loop);
   return {
    start() { wanted = true; loop.start(); watch(); },
    stop() { wanted = false; loop.stop(); },
    dispose: loop.dispose
   };
  },
  withActiveTimeout(promise, duration, message) {
   let remaining = duration, started, timer = null, unsubscribe;
   const cancel = () => {
    if (timer === null) return;
    win.clearTimeout(timer);
    timer = null;
    remaining -= now() - started;
   };
   const deadline = new Promise((_, reject) => {
    const update = enabled => {
     if (!enabled) { cancel(); return; }
     if (timer !== null) return;
     started = now();
     timer = win.setTimeout(() => {
      timer = null;
      if (active()) reject(new Error(message));
      else remaining -= now() - started;
     }, Math.max(0, remaining));
    };
    unsubscribe = api.subscribe(update);
    update(active());
   });
   return Promise.race([promise, deadline]).finally(() => { cancel(); unsubscribe(); });
  },
  diagnostics() { return {active:active(), loops:[...loops.keys()], loopRestarts, droppedPointers, recent:[...recent]}; }
 };
 instances.set(win, api);
 return api;
}

// Wait for a paint when possible. A suspended compositor must never own the
// only continuation of a UI handoff.
export function afterPaint(win) {
 return new Promise(resolve => {
  let frame, second;
  const done = () => {
   win.clearTimeout(timer);
   if (frame !== undefined) win.cancelAnimationFrame?.(frame);
   if (second !== undefined) win.cancelAnimationFrame?.(second);
   resolve();
  };
  const timer = win.setTimeout(done, 250);
  frame = win.requestAnimationFrame(() => { second = win.requestAnimationFrame(done); });
 });
}
