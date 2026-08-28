import assert from "node:assert/strict";

type CreateTecack = (typeof import("../packages/frontend/src/index"))["createTecack"];
type Listener = (event: Event) => void;
type FakeTouch = Pick<Touch, "clientX" | "clientY" | "identifier"> & { touchType?: string };

const frontendModule = (await import("../packages/frontend/src/index")) as unknown as {
  createTecack?: CreateTecack;
  default?: { createTecack?: CreateTecack };
};
const createTecack = frontendModule.createTecack ?? frontendModule.default?.createTecack;

assert.equal(typeof createTecack, "function");

class FakeCanvas {
  dataset: Record<string, string> = {};
  height = 100;
  listeners = new Map<string, Set<Listener>>();
  tabIndex = 0;
  width = 100;

  addEventListener(eventName: string, listener: Listener) {
    const listeners = this.listeners.get(eventName) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
  }

  removeEventListener(eventName: string, listener: Listener) {
    this.listeners.get(eventName)?.delete(listener);
  }

  dispatch(eventName: string, event: unknown) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(event as Event);
    }
  }

  getBoundingClientRect() {
    return { left: 0, top: 0 };
  }

  getContext(contextId: string) {
    assert.equal(contextId, "2d");
    return {
      beginPath() {},
      clearRect() {},
      closePath() {},
      fillRect() {},
      fillText() {},
      lineTo() {},
      moveTo() {},
      stroke() {},
      strokeText() {},
      set fillStyle(_value: string) {},
      set font(_value: string) {},
      set lineCap(_value: string) {},
      set lineWidth(_value: number) {},
      set strokeStyle(_value: string) {},
    };
  }
}

(globalThis as typeof globalThis & { HTMLCanvasElement: typeof FakeCanvas }).HTMLCanvasElement = FakeCanvas;

function createMountedTecack() {
  const canvas = new FakeCanvas();
  (globalThis as typeof globalThis & { window: unknown }).window = {
    document: {
      querySelector: (selector: string) => (selector === "#pad" ? canvas : null),
    },
  };

  const tecack = createTecack!();
  const result = tecack.mount("#pad");
  assert.equal(result, undefined);

  return { canvas, tecack };
}

function fakeTouch(identifier: number, clientX: number, clientY: number, touchType = "direct"): FakeTouch {
  return { clientX, clientY, identifier, touchType };
}

function fakeTouchList(touches: FakeTouch[]): TouchList {
  return Object.assign([...touches], {
    item: (index: number) => touches[index] ?? null,
  }) as unknown as TouchList;
}

function fakeTouchEvent(changedTouches: FakeTouch[], touches = changedTouches): TouchEvent {
  return {
    changedTouches: fakeTouchList(changedTouches),
    preventDefault() {},
    touches: fakeTouchList(touches),
  } as TouchEvent;
}

function fakeMouseEvent(clientX: number, clientY: number): MouseEvent {
  return { clientX, clientY } as MouseEvent;
}

function assertStrokeDoesNotInclude(
  stroke: ReadonlyArray<readonly [number, number]>,
  point: readonly [number, number],
) {
  assert.equal(
    stroke.some(([x, y]) => x === point[0] && y === point[1]),
    false,
  );
}

function run(name: string, test: () => void) {
  test();
  console.log(`ok - ${name}`);
}

run("ignores a second direct touch while drawing", () => {
  const { canvas, tecack } = createMountedTecack();
  const pen = fakeTouch(1, 10, 10, "stylus");
  const palm = fakeTouch(2, 90, 90);

  canvas.dispatch("touchstart", fakeTouchEvent([pen], [pen]));
  canvas.dispatch("touchmove", fakeTouchEvent([fakeTouch(1, 20, 20, "stylus")], [fakeTouch(1, 20, 20, "stylus")]));
  canvas.dispatch("touchstart", fakeTouchEvent([palm], [fakeTouch(1, 20, 20, "stylus"), palm]));
  canvas.dispatch(
    "touchmove",
    fakeTouchEvent([fakeTouch(1, 30, 30, "stylus")], [fakeTouch(1, 30, 30, "stylus"), palm]),
  );
  canvas.dispatch("touchend", fakeTouchEvent([palm], [fakeTouch(1, 30, 30, "stylus")]));
  canvas.dispatch("touchend", fakeTouchEvent([fakeTouch(1, 30, 30, "stylus")], []));

  const strokes = tecack.getStrokes();
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0][0], [10, 10]);
  assertStrokeDoesNotInclude(strokes[0], [90, 90]);
});

run("lets a stylus replace an existing direct touch", () => {
  const { canvas, tecack } = createMountedTecack();
  const finger = fakeTouch(1, 5, 5);
  const stylus = fakeTouch(2, 40, 40, "stylus");

  canvas.dispatch("touchstart", fakeTouchEvent([finger], [finger]));
  canvas.dispatch("touchstart", fakeTouchEvent([stylus], [finger, stylus]));
  canvas.dispatch(
    "touchmove",
    fakeTouchEvent([fakeTouch(2, 50, 50, "stylus")], [finger, fakeTouch(2, 50, 50, "stylus")]),
  );
  canvas.dispatch("touchend", fakeTouchEvent([fakeTouch(2, 50, 50, "stylus")], [finger]));

  const strokes = tecack.getStrokes();
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0][0], [40, 40]);
  assertStrokeDoesNotInclude(strokes[0], [5, 5]);
});

run("recovers when the active touch disappears before the next touchstart", () => {
  const { canvas, tecack } = createMountedTecack();
  const first = fakeTouch(1, 5, 5);
  const next = fakeTouch(2, 25, 25);

  canvas.dispatch("touchstart", fakeTouchEvent([first], [first]));
  canvas.dispatch("touchstart", fakeTouchEvent([next], [next]));
  canvas.dispatch("touchmove", fakeTouchEvent([fakeTouch(2, 35, 35)], [fakeTouch(2, 35, 35)]));
  canvas.dispatch("touchend", fakeTouchEvent([fakeTouch(2, 35, 35)], []));

  const strokes = tecack.getStrokes();
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0][0], [25, 25]);
});

run("touchcancel discards only the in-progress stroke", () => {
  const { canvas, tecack } = createMountedTecack();

  canvas.dispatch("touchstart", fakeTouchEvent([fakeTouch(1, 10, 10, "stylus")], [fakeTouch(1, 10, 10, "stylus")]));
  canvas.dispatch("touchmove", fakeTouchEvent([fakeTouch(1, 20, 20, "stylus")], [fakeTouch(1, 20, 20, "stylus")]));
  canvas.dispatch("touchcancel", fakeTouchEvent([fakeTouch(1, 20, 20, "stylus")], []));
  assert.equal(tecack.getStrokes().length, 0);

  canvas.dispatch("touchstart", fakeTouchEvent([fakeTouch(2, 30, 30, "stylus")], [fakeTouch(2, 30, 30, "stylus")]));
  canvas.dispatch("touchmove", fakeTouchEvent([fakeTouch(2, 40, 40, "stylus")], [fakeTouch(2, 40, 40, "stylus")]));
  canvas.dispatch("touchend", fakeTouchEvent([fakeTouch(2, 40, 40, "stylus")], []));

  const strokes = tecack.getStrokes();
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0][0], [30, 30]);
});

run("does not record a completed mouse stroke twice", () => {
  const { canvas, tecack } = createMountedTecack();

  canvas.dispatch("mousedown", fakeMouseEvent(10, 10));
  canvas.dispatch("mousemove", fakeMouseEvent(20, 20));
  canvas.dispatch("mouseup", fakeMouseEvent(20, 20));
  canvas.dispatch("mouseup", fakeMouseEvent(20, 20));

  assert.equal(tecack.getStrokes().length, 1);
});
