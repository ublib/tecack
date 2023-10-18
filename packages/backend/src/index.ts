import type { Position, TecackStroke, TecackDataset } from "@tecack/shared";

type M10 = (pattern: Readonly<Array<TecackStroke>>) => number;
type M01 = (pattern: Readonly<Array<TecackStroke>>) => number;
type M00 = (pattern: Readonly<Array<TecackStroke>>) => number;
type Mu20 = (pattern: Readonly<Array<TecackStroke>>, xc: number) => number;
type Mu02 = (pattern: Readonly<Array<TecackStroke>>, yc: number) => number;

type Aran = (width: number, height: number) => number;
type Transform = (pattern: Array<TecackStroke>, x_: number, y_: number) => Array<TecackStroke>;
type MomentNormalize = () => Array<TecackStroke>;
type Euclid = (x1y1: [number, number], x2y2: [number, number]) => number;
type ExtractFeatures = (input_data: Array<TecackStroke>, interval: number) => Array<TecackStroke>;
type EndPointDistance = (pattern1: TecackStroke, pattern2: TecackStroke) => number;
type InitialDistance = (pattern1: TecackStroke, pattern2: TecackStroke) => number;
type GetLargerAndSize = <T extends Array<any>>(pattern1: T, pattern2: T) => [T, T, number, number];
type WholeWholeDistance = (pattern1: TecackStroke, pattern2: TecackStroke) => number;
type InitStrokeMap = (
  pattern1: Array<TecackStroke>,
  pattern2: Array<TecackStroke>,
  distanceMetric: (a: TecackStroke, n: TecackStroke) => number,
) => Position;
type GetMap = (
  pattern1: Array<TecackStroke>,
  pattern2: Array<TecackStroke>,
  distanceMetric: (a: TecackStroke, n: TecackStroke) => number,
) => Position;
type CompleteMap = (
  pattern1: Array<TecackStroke>,
  pattern2: Array<TecackStroke>,
  distanceMetric: (a: TecackStroke, n: TecackStroke) => number,
  map: Array<number>,
) => Array<number>;
type ComputeDistance = (
  pattern1: Array<TecackStroke>,
  pattern2: Array<TecackStroke>,
  distanceMetric: (a: TecackStroke, n: TecackStroke) => number,
  map: Array<number>,
) => number;
type ComputeWholeDistanceWeighted = (
  pattern1: Array<TecackStroke>,
  pattern2: Array<TecackStroke>,
  map: Position,
) => number;
type CoarseClassification = (inputPattern: Array<TecackStroke>) => TecackStroke;
type FineClassification = (inputPattern: Array<TecackStroke>, inputCandidates: TecackStroke) => string[];

export function recognize(input: Readonly<Array<TecackStroke>>, dataset: Readonly<Array<TecackDataset>>): string[] {
  let newHeight: number;
  let newWidth: number;
  let oldHeight: number;
  let oldWidth: number;
  let xMin: number;
  let xMax: number;
  let yMin: number;
  let yMax: number;
  let x: number;
  let y: number;
  let dii: number;
  let j_of_i: number;
  let minDist: number;
  let min_j: number;

  const m10: M10 = pattern => {
    var sum = 0;
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      for (var j = 0; j < stroke_i.length; j++) {
        sum += stroke_i[j][0];
      }
    }
    return sum;
  };

  const m01: M01 = pattern => {
    var sum = 0;
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      for (var j = 0; j < stroke_i.length; j++) {
        sum += stroke_i[j][1];
      }
    }
    return sum;
  };

  const m00: M00 = pattern => {
    var sum = 0;
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      sum += stroke_i.length;
    }
    return sum;
  };

  const mu20: Mu20 = (pattern, xc) => {
    var sum = 0;
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      for (var j = 0; j < stroke_i.length; j++) {
        var diff = stroke_i[j][0] - xc;
        sum += diff * diff;
      }
    }
    return sum;
  };

  const mu02: Mu02 = (pattern, yc) => {
    var sum = 0;
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      for (var j = 0; j < stroke_i.length; j++) {
        var diff = stroke_i[j][1] - yc;
        sum += diff * diff;
      }
    }
    return sum;
  };

  const aran: Aran = (width, height) => {
    var r1 = 0;
    if (height > width) {
      r1 = width / height;
    } else {
      r1 = height / width;
    }

    var a = Math.PI / 2;
    var b = a * r1;
    var b1 = Math.sin(b);
    var c = Math.sqrt(b1);
    var d = c;

    var r2 = Math.sqrt(Math.sin((Math.PI / 2) * r1));
    return r2;
  };

  const transform: Transform = (pattern, x_, y_) => {
    var pt = new Array();
    for (var i = 0; i < pattern.length; i++) {
      var stroke_i = pattern[i];
      var c_stroke_i = new Array();
      for (var j = 0; j < stroke_i.length; j++) {
        var x = stroke_i[j][0] + x_;
        var y = stroke_i[j][1] + y_;
        c_stroke_i.push([x, y]);
      }
      pt.push(c_stroke_i);
    }
    return pt;
  };

  // main function for moment normalization
  const momentNormalize: MomentNormalize = () => {
    newHeight = 256;
    newWidth = 256;
    xMin = 256;
    xMax = 0;
    yMin = 256;
    yMax = 0;
    // first determine drawn character width / length
    for (var i = 0; i < input.length; i++) {
      var stroke_i = input[i];
      for (var j = 0; j < stroke_i.length; j++) {
        x = stroke_i[j][0];
        y = stroke_i[j][1];
        if (x < xMin) {
          xMin = x;
        }
        if (x > xMax) {
          xMax = x;
        }
        if (y < yMin) {
          yMin = y;
        }
        if (y > yMax) {
          yMax = y;
        }
      }
    }
    oldHeight = Math.abs(yMax - yMin);
    oldWidth = Math.abs(xMax - xMin);

    var r2 = aran(oldWidth, oldHeight);

    var aranWidth = newWidth;
    var aranHeight = newHeight;

    if (oldHeight > oldWidth) {
      aranWidth = r2 * newWidth;
    } else {
      aranHeight = r2 * newHeight;
    }

    var xOffset = (newWidth - aranWidth) / 2;
    var yOffset = (newHeight - aranHeight) / 2;

    var m00_ = m00(input);
    var m01_ = m01(input);
    var m10_ = m10(input);

    var xc_ = m10_ / m00_;
    var yc_ = m01_ / m00_;

    var xc_half = aranWidth / 2;
    var yc_half = aranHeight / 2;

    var mu20_ = mu20(input, xc_);
    var mu02_ = mu02(input, yc_);

    var alpha = aranWidth / (4 * Math.sqrt(mu20_ / m00_)) || 0;
    var beta = aranHeight / (4 * Math.sqrt(mu02_ / m00_)) || 0;

    var nf = new Array();
    for (var i = 0; i < input.length; i++) {
      var si = input[i];
      var nsi = new Array();
      for (var j = 0; j < si.length; j++) {
        var newX = alpha * (si[j][0] - xc_) + xc_half;
        var newY = beta * (si[j][1] - yc_) + yc_half;

        nsi.push([newX, newY]);
      }
      nf.push(nsi);
    }

    return transform(nf, xOffset, yOffset);
  };

  // distance functions
  const euclid: Euclid = (x1y1, x2y2) => {
    var a = x1y1[0] - x2y2[0];
    var b = x1y1[1] - x2y2[1];
    var c = Math.sqrt(a * a + b * b);
    return c;
  };

  // extract points in regular intervals
  const extractFeatures: ExtractFeatures = (input_data, interval) => {
    var extractedPattern = new Array();
    var nrStrokes = input_data.length;
    for (var i = 0; i < nrStrokes; i++) {
      var stroke_i = input_data[i];
      var extractedStroke_i = new Array();
      var dist = 0.0;
      var j = 0;
      while (j < stroke_i.length) {
        // always add first point
        if (j == 0) {
          var x1y1 = stroke_i[0];
          extractedStroke_i.push(x1y1);
        }
        if (j > 0) {
          var x1y1 = stroke_i[j - 1];
          var x2y2 = stroke_i[j];
          dist += euclid(x1y1, x2y2);
        }
        if (dist >= interval && j > 1) {
          dist = dist - interval;
          var x1y1 = stroke_i[j];
          extractedStroke_i.push(x1y1);
        }
        j++;
      }
      // if we so far have only one point, always add last point
      if (extractedStroke_i.length == 1) {
        var x1y1 = stroke_i[stroke_i.length - 1];
        extractedStroke_i.push(x1y1);
      } else {
        if (dist > 0.75 * interval) {
          var x1y1 = stroke_i[stroke_i.length - 1];
          extractedStroke_i.push(x1y1);
        }
      }
      extractedPattern.push(extractedStroke_i);
    }
    return extractedPattern;
  };

  const endPointDistance: EndPointDistance = (pattern1, pattern2) => {
    var dist = 0;
    var l1 = typeof pattern1 == "undefined" ? 0 : pattern1.length;
    var l2 = typeof pattern2 == "undefined" ? 0 : pattern2.length;
    if (l1 == 0 || l2 == 0) {
      return 0;
    } else {
      var x1y1 = pattern1[0];
      var x2y2 = pattern2[0];
      dist += Math.abs(x1y1[0] - x2y2[0]) + Math.abs(x1y1[1] - x2y2[1]);
      x1y1 = pattern1[l1 - 1];
      x2y2 = pattern2[l2 - 1];
      dist += Math.abs(x1y1[0] - x2y2[0]) + Math.abs(x1y1[1] - x2y2[1]);
    }
    return dist;
  };

  const initialDistance: InitialDistance = (pattern1, pattern2) => {
    var l1 = pattern1.length;
    var l2 = pattern2.length;
    var l_min = Math.min(l1, l2);
    var l_max = Math.max(l1, l2);
    var dist = 0;
    for (var i = 0; i < l_min; i++) {
      var x1y1 = pattern1[i];
      var x2y2 = pattern2[i];
      dist += Math.abs(x1y1[0] - x2y2[0]) + Math.abs(x1y1[1] - x2y2[1]);
    }
    return dist * (l_max / l_min);
  };

  // given to pattern, determine longer (more strokes)
  // and return quadruple with sorted patterns and their
  // stroke numbers [k1,k2,n,m] where n >= m and
  // they denote the #of strokes of k1 and k2
  const getLargerAndSize: GetLargerAndSize = (pattern1, pattern2) => {
    var l1 = typeof pattern1 == "undefined" ? 0 : pattern1.length;
    var l2 = typeof pattern2 == "undefined" ? 0 : pattern2.length;
    // definitions as in paper
    // i.e. n is larger
    var n = l1;
    var m = l2;
    var k1 = pattern1;
    var k2 = pattern2;
    if (l1 < l2) {
      m = l1;
      n = l2;
      k1 = pattern2;
      k2 = pattern1;
    }
    return [k1, k2, n, m];
  };

  const wholeWholeDistance: WholeWholeDistance = (pattern1, pattern2) => {
    // [k1, k2, n, m]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    var dist = 0;
    for (var i = 0; i < a[3]; i++) {
      j_of_i = parseInt((parseInt((a[2] / a[3]) as any) * i) as any);
      var x1y1 = a[0][j_of_i];
      var x2y2 = a[1][i];
      dist += Math.abs(x1y1[0] - x2y2[0]) + Math.abs(x1y1[1] - x2y2[1]);
    }
    return parseInt((dist / a[3]) as any);
  };

  // initialize N-stroke map by greedy initialization
  const initStrokeMap: InitStrokeMap = (pattern1, pattern2, distanceMetric) => {
    // [k1, k2, n, m]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    // larger is now k1 with length n
    var map = new Array() as Position;
    for (var i = 0; i < a[2]; i++) {
      map[i] = -1;
    }
    var free = new Array();
    for (var i = 0; i < a[2]; i++) {
      free[i] = true;
    }
    for (var i = 0; i < a[3]; i++) {
      minDist = 10000000;
      min_j = -1;
      for (var j = 0; j < a[2]; j++) {
        if (free[j] == true) {
          var d = distanceMetric(a[0][j], a[1][i]);
          if (d < minDist) {
            minDist = d;
            min_j = j;
          }
        }
      }
      free[min_j] = false;
      map[min_j] = i;
    }
    return map;
  };

  // get best N-stroke map by iterative improvement
  const getMap: GetMap = (pattern1, pattern2, distanceMetric) => {
    // [k1, k2, n, m]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    // larger is now k1 with length n
    var L = 3;
    var map = initStrokeMap(a[0], a[1], distanceMetric);
    for (var l = 0; l < L; l++) {
      for (var i = 0; i < map.length; i++) {
        if (map[i] != -1) {
          dii = distanceMetric(a[0][i], a[1][map[i]]);
          for (var j = 0; j < map.length; j++) {
            // we need to check again, since
            // manipulation of map[i] can occur within
            // the j-loop
            if (map[i] != -1) {
              if (map[j] != -1) {
                var djj = distanceMetric(a[0][j], a[1][map[j]]);
                var dij = distanceMetric(a[0][j], a[1][map[i]]);
                var dji = distanceMetric(a[0][i], a[1][map[j]]);
                if (dji + dij < dii + djj) {
                  var map_j = map[j];
                  map[j] = map[i];
                  map[i] = map_j;
                  dii = dij;
                }
              } else {
                var dij = distanceMetric(a[0][j], a[1][map[i]]);
                if (dij < dii) {
                  map[j] = map[i];
                  map[i] = -1;
                  dii = dij;
                }
              }
            }
          }
        }
      }
    }
    return map;
  };

  // from optimal N-stroke map create M-N stroke map
  const completeMap: CompleteMap = (pattern1, pattern2, distanceMetric, map) => {
    // [k1, k2, _, _]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    if (!map.includes(-1)) {
      return map;
    }
    // complete at the end
    var lastUnassigned = map[map.length];
    var mapLastTo = -1;
    for (var i = map.length - 1; i >= 0; i--) {
      if (map[i] == -1) {
        lastUnassigned = i;
      } else {
        mapLastTo = map[i];
        break;
      }
    }
    for (var i = lastUnassigned; i < map.length; i++) {
      map[i] = mapLastTo;
    }
    // complete at the beginning
    var firstUnassigned = -1;
    var mapFirstTo = -1;
    for (var i = 0; i < map.length; i++) {
      if (map[i] == -1) {
        firstUnassigned = i;
      } else {
        mapFirstTo = map[i];
        break;
      }
    }
    for (var i = 0; i <= firstUnassigned; i++) {
      map[i] = mapFirstTo;
    }
    // for the remaining unassigned, check
    // where to "split"
    for (var i = 0; i < map.length; i++) {
      if (i + 1 < map.length && map[i + 1] == -1) {
        // we have a situation like this:
        //   i       i+1   i+2   ...  i+n
        //   start   -1    ?     -1   stop
        var start = i;

        var stop = i + 1;
        while (stop < map.length && map[stop] == -1) {
          stop++;
        }

        var div = start;
        var max_dist = 1000000;
        for (var j = start; j < stop; j++) {
          var stroke_ab = a[0][start];
          // iteration of concat, possibly slow
          // due to memory allocations; optimize?!
          for (var temp = start + 1; temp <= j; temp++) {
            stroke_ab = stroke_ab.concat(a[0][temp]);
          }
          var stroke_bc = a[0][j + 1];

          for (var temp = j + 2; temp <= stop; temp++) {
            stroke_bc = stroke_bc.concat(a[0][temp]);
          }

          var d_ab = distanceMetric(stroke_ab, a[1][map[start]]);
          var d_bc = distanceMetric(stroke_bc, a[1][map[stop]]);
          if (d_ab + d_bc < max_dist) {
            div = j;
            max_dist = d_ab + d_bc;
          }
        }
        for (var j = start; j <= div; j++) {
          map[j] = map[start];
        }
        for (var j = div + 1; j < stop; j++) {
          map[j] = map[stop];
        }
      }
    }
    return map as [number, number];
  };

  // given two patterns, M-N stroke map and distanceMetric function,
  // compute overall distance between two patterns
  const computeDistance: ComputeDistance = (pattern1, pattern2, distanceMetric, map) => {
    // [k1, k2, n, m]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    var dist = 0.0;
    var idx = 0;
    while (idx < a[2]) {
      var stroke_idx = a[1][map[idx]];
      var start = idx;
      var stop = start + 1;
      while (stop < map.length && map[stop] == map[idx]) {
        stop++;
      }
      var stroke_concat = a[0][start];
      for (var temp = start + 1; temp < stop; temp++) {
        stroke_concat = stroke_concat.concat(a[0][temp]);
      }
      dist += distanceMetric(stroke_idx, stroke_concat);
      idx = stop;
    }
    return dist;
  };

  // given two patterns, M-N stroke_map, compute weighted (respect stroke
  // length when there are concatenated strokes using the wholeWhole distance
  const computeWholeDistanceWeighted: ComputeWholeDistanceWeighted = (pattern1, pattern2, map) => {
    // [k1, k2, n, m]
    // a[0], a[1], a[2], a[3]
    var a = getLargerAndSize(pattern1, pattern2);
    var dist = 0.0;
    var idx = 0;
    while (idx < a[2]) {
      var stroke_idx = a[1][map[idx]];
      var start = idx;
      var stop = start + 1;
      while (stop < map.length && map[stop] == map[idx]) {
        stop++;
      }
      var stroke_concat = a[0][start];
      for (var temp = start + 1; temp < stop; temp++) {
        stroke_concat = stroke_concat.concat(a[0][temp]);
      }

      var dist_idx = wholeWholeDistance(stroke_idx, stroke_concat);
      if (stop > start + 1) {
        // concatenated stroke, adjust weight
        var mm = typeof stroke_idx == "undefined" ? 0 : stroke_idx.length;
        var nn = stroke_concat.length;
        if (nn < mm) {
          var temp = nn;
          nn = mm;
          mm = temp;
        }
        dist_idx = dist_idx * (nn / mm);
      }
      dist += dist_idx;
      idx = stop;
    }
    return dist;
  };

  // apply coarse classfication w.r.t. inputPattern
  // considering _all_ referencePatterns using endpoint distance
  const coarseClassification: CoarseClassification = inputPattern => {
    var inputLength = inputPattern.length;
    var candidates: TecackStroke = [];
    for (var i = 0; i < dataset.length; i++) {
      var iLength = dataset[i][1];
      if (inputLength < iLength + 2 && inputLength > iLength - 3) {
        var iPattern = dataset[i][2];
        var iMap = getMap(iPattern, inputPattern, endPointDistance);
        iMap = completeMap(iPattern, inputPattern, endPointDistance, iMap) as Position;
        var dist = computeDistance(iPattern, inputPattern, endPointDistance, iMap);
        var m = iLength;
        var n = iPattern.length;
        if (n < m) {
          var temp = n;
          n = m;
          m = temp;
        }
        candidates.push([i, dist * (m / n)]);
      }
    }
    candidates.sort(function (a, b) {
      return a[1] - b[1];
    });

    return candidates;
  };

  // fine classfication. returns best 100 matches for inputPattern
  // and candidate list (which should be provided by coarse classification
  const fineClassification: FineClassification = (inputPattern, inputCandidates) => {
    var inputLength = inputPattern.length;
    var candidates = [];
    for (var i = 0; i < Math.min(inputCandidates.length, 100); i++) {
      var j = inputCandidates[i][0];
      var iLength = dataset[j][1];
      var iPattern = dataset[j][2];
      if (inputLength < iLength + 2 && inputLength > iLength - 3) {
        var iMap = getMap(iPattern, inputPattern, initialDistance);

        iMap = completeMap(iPattern, inputPattern, wholeWholeDistance, iMap) as Position;
        if (dataset[j][0] == "委") {
          console.log("finished imap, fine:");
          console.log(iMap);
          console.log("weight:");
          console.log(computeDistance(iPattern, inputPattern, wholeWholeDistance, iMap));
          console.log("weight intended:");
          console.log(computeDistance(iPattern, inputPattern, wholeWholeDistance, [0, 1, 2, 3, 4, 7, 5, 6]));
        }
        var dist = computeWholeDistanceWeighted(iPattern, inputPattern, iMap);
        var n = inputLength;
        var m = iPattern.length;
        if (m > n) {
          m = n;
        }
        dist = dist / m;
        candidates.push([j, dist]);
      }
    }
    candidates.sort(function (a, b) {
      return a[1] - b[1];
    });
    const outputs: string[] = [];
    for (var i = 0; i < Math.min(candidates.length, 10); i++) {
      outputs.push(dataset[candidates[i][0]][0]);
    }

    return outputs;
  };

  const _recognize = () => {
    var mn = momentNormalize();

    var extractedFeatures = extractFeatures(mn, 20);

    var map = getMap(extractedFeatures, dataset[0][2], endPointDistance);
    map = completeMap(extractedFeatures, dataset[0][2], endPointDistance, map) as Position;

    var candidates = coarseClassification(extractedFeatures);
    return fineClassification(extractedFeatures, candidates);
  };

  return _recognize();
}
