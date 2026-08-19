import type { TecackStroke } from "@tecack/shared";
import { CanvasCtxNotFoundError, InitializeError } from "./errors";

export * from "./errors";

export interface TecackOptions {
  backgroundPainter?: (el: HTMLCanvasElement) => void;
}

export interface DrawStrokeOrderOptions {
  /** default: `false` */
  withColor?: boolean;

  /**
   * default:
   * ```ts
   * [
   *   "#bf0000", "#bf5600", "#bfac00", "#7cbf00", "#26bf00",
   *   "#00bf2f", "#00bf85", "#00a2bf", "#004cbf", "#0900bf",
   *   "#5f00bf", "#b500bf", "#bf0072", "#bf001c", "#bf2626",
   *   "#bf6b26", "#bfaf26", "#89bf26", "#44bf26", "#26bf4c",
   *   "#26bf91", "#26a8bf", "#2663bf", "#2d26bf", "#7226bf",
   *   "#b726bf", "#bf2682", "#bf263d", "#bf4c4c", "#bf804c",
   * ]
   * ```
   * color coded stroke colors (for 30 strokes)
   *
   * based on https://kanjivg.tagaini.net/viewer.html
   *
   * NOTE: must be 6-digit hex color codes (e.g. `#ff0000`)
   */
  colorSet?: Array<string>;

  font?: {
    /** default: "helvetica" */
    family?: string;

    /** default: "16px" */
    size?: string;
  };
}

export interface Tecack {
  $el: HTMLCanvasElement | null;

  mount: (selector: string) => void | InitializeError;

  /**
   * The contents of the tecack instance are retained, only the association with the DOM is removed.
   *
   * (Discard retention of event listeners and $el's.)
   */
  unmount: (options?: {
    /**
     * default: `true`
     *
     * setting cleanCanvas to false will keep the current canvas drawing state
     */
    cleanCanvas?: boolean;
    /**
     * default: `false`
     *
     * When this option is enabled, the cleanCanvas option is ignored.
     */
    force?: boolean;
  }) => void;

  draw: (color?: string) => void | CanvasCtxNotFoundError;
  deleteLast: () => void | CanvasCtxNotFoundError;
  erase: () => void | CanvasCtxNotFoundError;
  drawStrokeOrder: (options?: DrawStrokeOrderOptions) => void | CanvasCtxNotFoundError;
  restoreFromStrokes(
    strokesMut: Readonly<Array<TecackStroke>>,
    options?: {
      /** default: `true` */
      withDraw: boolean;
    },
  ): void;
  getStrokes: () => Readonly<Array<TecackStroke>>;
  normalizeLinear: () => void;
}

export function createTecack(options?: TecackOptions): Tecack {
  // private properties
  let _selector: string;
  let _canvas: HTMLCanvasElement | null;
  let _ctx: CanvasRenderingContext2D | null;
  let _w: number;
  let _h: number;
  let _flagOver: boolean = false;
  let _flagDown: boolean = false;
  let _prevX: number = 0;
  let _currX: number = 0;
  let _prevY: number = 0;
  let _currY: number = 0;
  let _newHeight: number;
  let _newWidth: number;
  let _oldHeight: number;
  let _oldWidth: number;
  let _xMin: number;
  let _xMax: number;
  let _yMin: number;
  let _yMax: number;
  let _x: number;
  let _y: number;
  let _xNorm: number;
  let _yNorm: number;
  let _dot_flag: boolean = false;
  let _recordedPattern: Array<TecackStroke> = new Array();
  let _currentLine: TecackStroke | null = null;

  const listeners: { [event: Parameters<typeof document.addEventListener>[0]]: (e: Event) => void } = {
    mousemove: e => _find_x_y("move", e as MouseEvent),
    mousedown: e => _find_x_y("down", e as MouseEvent),
    mouseup: e => _find_x_y("up", e as MouseEvent),
    mouseout: e => _find_x_y("out", e as MouseEvent),
    mouseover: e => _find_x_y("over", e as MouseEvent),
    touchmove: e => _find_x_y("move", e as TouchEvent),
    touchstart: e => _find_x_y("down", e as TouchEvent),
    touchend: e => _find_x_y("up", e as TouchEvent),
  };

  // NOTE: Initialized with null or undefined to ensure compatibility with pre-fork implementations.
  const tecack: Tecack = {
    $el: null,

    mount: selector => {
      _selector = selector;
      const c = window.document.querySelector(_selector);
      if (!c) {
        return new InitializeError(`Canvas#${_selector} was not found.`);
      }
      if (!(c instanceof HTMLCanvasElement)) {
        return new InitializeError(
          `Canvas#${_selector} is not an HTMLCanvasElement. got ${c.constructor.name} instead.`,
        );
      }

      // set properties
      tecack.$el = c;
      _canvas = c;
      _canvas.tabIndex = 0; // makes canvas focusable, allowing usage of shortcuts
      _ctx = _canvas.getContext("2d");
      _w = _canvas.width;
      _h = _canvas.height;

      // paint background
      options?.backgroundPainter?.(_canvas);

      // attach listeners
      Object.entries(listeners).forEach(([event, listener]) => _canvas?.addEventListener(event, listener));
    },

    unmount: unmountOptions => {
      const { cleanCanvas = true, force = false } = unmountOptions || {};
      // detach listeners
      Object.entries(listeners).forEach(([event, listener]) => _canvas?.removeEventListener(event, listener));

      // clear canvas
      if (cleanCanvas) {
        _ctx?.clearRect(0, 0, _w, _h);
        _canvas && !force && options?.backgroundPainter?.(_canvas);
      }

      // reset properties
      _canvas = tecack.$el = null;
      _ctx = null;
    },

    draw: color => {
      if (!_ctx) {
        return createCanvasError();
      }
      _ctx.beginPath();
      _ctx.moveTo(_prevX, _prevY);
      _ctx.lineTo(_currX, _currY);
      _ctx.strokeStyle = color ? color : "#333";
      _ctx.lineCap = "round";
      _ctx.lineWidth = 4;
      _ctx.stroke();
      _ctx.closePath();
    },

    deleteLast: () => {
      if (!_ctx) {
        return createCanvasError();
      }
      _ctx.clearRect(0, 0, _w, _h);

      _canvas && options?.backgroundPainter?.(_canvas);
      for (var i = 0; i < _recordedPattern.length - 1; i++) {
        var stroke_i = _recordedPattern[i];
        for (var j = 0; j < stroke_i.length - 1; j++) {
          _prevX = stroke_i[j][0];
          _prevY = stroke_i[j][1];
          _currX = stroke_i[j + 1][0];
          _currY = stroke_i[j + 1][1];
          tecack.draw();
        }
      }
      _recordedPattern.pop();
    },

    erase: () => {
      if (!_ctx) {
        return createCanvasError();
      }
      _ctx.clearRect(0, 0, _w, _h);
      _recordedPattern.length = 0;
      _canvas && options?.backgroundPainter?.(_canvas);
    },

    drawStrokeOrder: opt => {
      const merged = mergeDrawStrokeOrderOptions(opt ?? {});
      const BASE_COLOR = "#444444";

      if (!_ctx) {
        return createCanvasError();
      }
      _ctx.clearRect(0, 0, _w, _h);

      _canvas && options?.backgroundPainter?.(_canvas);
      // draw strokes
      for (var i = 0; i < _recordedPattern.length; i++) {
        var stroke_i = _recordedPattern[i];

        for (var j = 0; j < stroke_i.length - 1; j++) {
          _prevX = stroke_i[j][0];
          _prevY = stroke_i[j][1];

          _currX = stroke_i[j + 1][0];
          _currY = stroke_i[j + 1][1];
          tecack.draw(merged.withColor ? merged.colorSet[i % merged.colorSet.length] : BASE_COLOR);
        }
      }

      // draw stroke numbers
      if (_canvas?.dataset.strokeNumbers != "false") {
        for (var i = 0; i < _recordedPattern.length; i++) {
          var stroke_i = _recordedPattern[i],
            x = stroke_i[Math.floor(stroke_i.length / 2)][0] + 5,
            y = stroke_i[Math.floor(stroke_i.length / 2)][1] - 5;

          _ctx.font = `${merged.font.size} ${merged.font.family}`;

          // outline
          _ctx.lineWidth = 0.5;
          _ctx.strokeStyle = _alterHex(
            merged.withColor && merged.colorSet[i % merged.colorSet.length]
              ? merged.colorSet[i % merged.colorSet.length]
              : BASE_COLOR,
            60,
            "dec",
          );
          _ctx.strokeText((i + 1).toString(), x, y);

          // fill
          _ctx.fillStyle =
            merged.withColor && merged.colorSet[i % merged.colorSet.length]
              ? merged.colorSet[i % merged.colorSet.length]
              : BASE_COLOR;
          _ctx.fillText((i + 1).toString(), x, y);
        }
      }
    },

    restoreFromStrokes: (strokesMut, restoreOption) => {
      const { withDraw = true } = restoreOption || {};
      _recordedPattern = [...strokesMut];
      if (withDraw) {
        if (!_ctx) return createCanvasError();
        _ctx.clearRect(0, 0, _w, _h);
        _canvas && options?.backgroundPainter?.(_canvas);
        for (var i = 0; i < _recordedPattern.length; i++) {
          var stroke_i = _recordedPattern[i];
          for (var j = 0; j < stroke_i.length - 1; j++) {
            _prevX = stroke_i[j][0];
            _prevY = stroke_i[j][1];
            _currX = stroke_i[j + 1][0];
            _currY = stroke_i[j + 1][1];
            tecack.draw();
          }
        }
      }
    },

    normalizeLinear: () => {
      var normalizedPattern = new Array();
      _newHeight = 256;
      _newWidth = 256;
      _xMin = 256;
      _xMax = 0;
      _yMin = 256;
      _yMax = 0;
      // first determine drawn character width / length
      for (var i = 0; i < _recordedPattern.length; i++) {
        var stroke_i = _recordedPattern[i];
        for (var j = 0; j < stroke_i.length; j++) {
          _x = stroke_i[j][0];
          _y = stroke_i[j][1];
          if (_x < _xMin) {
            _xMin = _x;
          }
          if (_x > _xMax) {
            _xMax = _x;
          }
          if (_y < _yMin) {
            _yMin = _y;
          }
          if (_y > _yMax) {
            _yMax = _y;
          }
        }
      }
      _oldHeight = Math.abs(_yMax - _yMin);
      _oldWidth = Math.abs(_xMax - _xMin);

      for (var i = 0; i < _recordedPattern.length; i++) {
        var stroke_i = _recordedPattern[i];
        var normalized_stroke_i = new Array();
        for (var j = 0; j < stroke_i.length; j++) {
          _x = stroke_i[j][0];
          _y = stroke_i[j][1];
          _xNorm = (_x - _xMin) * (_newWidth / _oldWidth);
          _yNorm = (_y - _yMin) * (_newHeight / _oldHeight);
          normalized_stroke_i.push([_xNorm, _yNorm]);
        }
        normalizedPattern.push(normalized_stroke_i);
      }
      _recordedPattern = normalizedPattern;
      // tecack.redraw(); // FIXME:
    },

    getStrokes: () => {
      return _recordedPattern;
    },
  };

  const _find_x_y = (res: string, e: MouseEvent | TouchEvent): void | CanvasCtxNotFoundError => {
    const isTouch = isTouchEvent(e);
    var touch = isTouch ? e.changedTouches[0] : null;

    if (isTouch) e.preventDefault(); // prevent scrolling while drawing to the canvas

    if (res == "down" && _canvas) {
      var rect = _canvas.getBoundingClientRect();
      _prevX = _currX;
      _prevY = _currY;
      _currX = (isTouch ? touch!.clientX : e.clientX) - rect.left;
      _currY = (isTouch ? touch!.clientY : e.clientY) - rect.top;
      _currentLine = new Array();
      _currentLine.push([_currX, _currY]);

      _flagDown = true;
      _flagOver = true;
      _dot_flag = true;
      if (_dot_flag) {
        if (!_ctx) {
          return createCanvasError();
        }
        _ctx.beginPath();
        _ctx.fillRect(_currX, _currY, 2, 2);
        _ctx.closePath();
        _dot_flag = false;
      }
    }
    // NOTE: `_currentLine` is discarded once it has been recorded so that a redundant
    // "up" / "out" (e.g. a palm touch on tablets fires an extra `touchend`) does not
    // record the very same stroke again.
    if (res == "up") {
      _flagDown = false;
      if (_flagOver == true && _currentLine) {
        _recordedPattern.push(_currentLine);
        _currentLine = null;
      }
    }

    if (res == "out") {
      _flagOver = false;
      if (_flagDown == true && _currentLine) {
        _recordedPattern.push(_currentLine);
        _currentLine = null;
      }
      _flagDown = false;
    }

    if (res == "move" && _canvas) {
      if (_flagOver && _flagDown) {
        var rect = _canvas.getBoundingClientRect();
        _prevX = _currX;
        _prevY = _currY;
        _currX = (isTouch ? touch!.clientX : e.clientX) - rect.left;
        _currY = (isTouch ? touch!.clientY : e.clientY) - rect.top;
        _currentLine?.push([_prevX, _prevY]);
        _currentLine?.push([_currX, _currY]);
        tecack.draw();
      }
    }
  };

  /**
   *
   * modifies hex colors to darken or lighten them
   *
   * ex: Tecack.alterHex(Tecack.strokeColors[0], 60, 'dec'); // decrement all colors by 60 (use 'inc' to increment)
   */
  const _alterHex = (hex: string, number: number, action: "inc" | "dec"): string => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex),
      color: [string | number, string | number, string | number] = [
        parseInt(result![1], 16),
        parseInt(result![2], 16),
        parseInt(result![3], 16),
      ],
      i = 0,
      j = color.length;

    for (; i < j; i++) {
      switch (action) {
        case "inc":
          color[i] = ((color[i] as number) + number > 255 ? 255 : (color[i] as number) + number).toString(16);
          break;

        case "dec":
          color[i] = ((color[i] as number) - number < 0 ? 0 : (color[i] as number) - number).toString(16);
          break;

        default:
          break;
      }

      // add trailing 0
      if ((color[i] as string).length == 1) color[i] = color[i] + "0";
    }

    return "#" + color.join("");
  };

  const createCanvasError = () =>
    new CanvasCtxNotFoundError(`CanvasRenderingContext2D for Canvas#${_selector} was not found.`);

  const isTouchEvent = (e: unknown): e is TouchEvent => typeof e === "object" && e !== null && "changedTouches" in e;

  return tecack;
}

// color coded stroke colors (for 30 strokes)
// based on https://kanjivg.tagaini.net/viewer.html
const STROKE_COLORS = [
  "#bf0000",
  "#bf5600",
  "#bfac00",
  "#7cbf00",
  "#26bf00",
  "#00bf2f",
  "#00bf85",
  "#00a2bf",
  "#004cbf",
  "#0900bf",
  "#5f00bf",
  "#b500bf",
  "#bf0072",
  "#bf001c",
  "#bf2626",
  "#bf6b26",
  "#bfaf26",
  "#89bf26",
  "#44bf26",
  "#26bf4c",
  "#26bf91",
  "#26a8bf",
  "#2663bf",
  "#2d26bf",
  "#7226bf",
  "#b726bf",
  "#bf2682",
  "#bf263d",
  "#bf4c4c",
  "#bf804c",
];

type DeepRequired<T> = {
  [P in keyof T]-?: DeepRequired<T[P]>;
};

const mergeDrawStrokeOrderOptions = (users: DrawStrokeOrderOptions): DeepRequired<DrawStrokeOrderOptions> => {
  const defaultOptions: DeepRequired<DrawStrokeOrderOptions> = {
    withColor: false,
    colorSet: STROKE_COLORS,
    font: {
      family: "helvetica",
      size: "16px",
    },
  };

  return {
    withColor: users.withColor ?? defaultOptions.withColor,
    colorSet: users.colorSet ?? defaultOptions.colorSet,
    font: {
      family: users.font?.family ?? defaultOptions.font.family,
      size: users.font?.size ?? defaultOptions.font.size,
    },
  };
};
