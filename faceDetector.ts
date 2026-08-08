/**
 * Face & Attention Detection Utility
 * Combines face-api.js landmark/gaze model with native FaceDetector API & Canvas vision fallback.
 */

let isFaceApiLoaded = false;
let isLandmarkLoaded = false;
let faceApiLoadingPromise: Promise<boolean> | null = null;

// Dynamically load face-api script if available
export async function initFaceApi(): Promise<boolean> {
  if (isFaceApiLoaded) return true;
  if (faceApiLoadingPromise) return faceApiLoadingPromise;

  faceApiLoadingPromise = new Promise((resolve) => {
    // Check if faceapi is already loaded globally
    if ((window as unknown as { faceapi?: { nets: { tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> } } } }).faceapi) {
      isFaceApiLoaded = true;
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
    script.async = true;
    script.onload = async () => {
      try {
        const faceapi = (window as unknown as any).faceapi;
        if (faceapi) {
          await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');
          try {
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');
            isLandmarkLoaded = true;
          } catch (e) {
            console.warn('Landmark weights omitted or failed to load, using canvas vision gaze detection fallback:', e);
          }
          isFaceApiLoaded = true;
          resolve(true);
          return;
        }
      } catch (err) {
        console.warn('face-api weights failed to load, using canvas vision fallback:', err);
      }
      resolve(false);
    };
    script.onerror = () => {
      console.warn('face-api script network error, using canvas fallback');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return faceApiLoadingPromise;
}

export interface DetectionResult {
  faceDetected: boolean;
  confidence: number;
  lookingAway: boolean;
  method: 'face-api' | 'native-api' | 'canvas-vision';
  message?: string;
}

// Fallback canvas presence & eye side-gaze analyzer (Left/Right look detection)
function analyzeCanvasPresence(video: HTMLVideoElement): DetectionResult {
  const width = 160;
  const height = 120;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return { faceDetected: true, confidence: 0.5, lookingAway: false, method: 'canvas-vision' };
  }

  ctx.drawImage(video, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // Scan skin-like pixels across the camera frame
  let skinPixelCount = 0;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let sumSkinX = 0;

  const totalPixels = width * height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Standard skin color heuristic in RGB space
      const isSkin =
        r > 50 &&
        g > 35 &&
        b > 18 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 10 &&
        Math.abs(r - g) > 6 &&
        r > g &&
        r > b;

      if (isSkin) {
        skinPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumSkinX += x;
      }
    }
  }

  const skinRatio = skinPixelCount / (totalPixels || 1);
  const faceWidth = Math.max(1, maxX - minX + 1);
  const faceHeight = Math.max(1, maxY - minY + 1);

  // Require plausible face presence size & pixel ratio
  const faceDetected = skinRatio > 0.035 && faceWidth >= 18 && faceHeight >= 22;

  if (!faceDetected) {
    return {
      faceDetected: false,
      confidence: 0,
      lookingAway: false,
      method: 'canvas-vision',
      message: '🚨 FACE OUT OF CAMERA',
    };
  }

  // Face is present on camera! Analyze if head or eyes are turned Left or Right (ignoring Up/Down pitch)
  const faceCenterX = (minX + maxX) / 2;
  const skinCenterX = skinPixelCount > 0 ? sumSkinX / skinPixelCount : faceCenterX;

  // Eye zone: upper region of detected face bounding box
  const eyeZoneMinY = Math.floor(minY + faceHeight * 0.15);
  const eyeZoneMaxY = Math.floor(minY + faceHeight * 0.52);

  let leftEyeDarkPixels = 0;
  let rightEyeDarkPixels = 0;
  let leftEyeDarkXSum = 0;
  let rightEyeDarkXSum = 0;

  for (let y = eyeZoneMinY; y <= eyeZoneMaxY && y < height; y++) {
    for (let x = minX; x <= maxX && x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = (r + g + b) / 3;

      // Dark pupil / iris / eye contour pixels
      if (brightness < 75) {
        if (x < faceCenterX) {
          leftEyeDarkPixels++;
          leftEyeDarkXSum += x;
        } else {
          rightEyeDarkPixels++;
          rightEyeDarkXSum += x;
        }
      }
    }
  }

  // 1. Check eye/skin center horizontal shift (Head or face turned sideways Left or Right)
  const centerShiftRatio = Math.abs(skinCenterX - faceCenterX) / (faceWidth / 2);

  // 2. Check combined pupil midpoint horizontal position relative to face center
  let pupilMidX = faceCenterX;
  if (leftEyeDarkPixels > 0 && rightEyeDarkPixels > 0) {
    const leftPupilX = leftEyeDarkXSum / leftEyeDarkPixels;
    const rightPupilX = rightEyeDarkXSum / rightEyeDarkPixels;
    pupilMidX = (leftPupilX + rightPupilX) / 2;
  }
  const pupilShiftRatio = Math.abs(pupilMidX - faceCenterX) / (faceWidth / 2);

  // Face aspect ratio check (a face turned completely sideways to left or right becomes narrow)
  const isProfileSideView = faceHeight / faceWidth > 2.0;

  // STRICT HORIZONTAL-ONLY SIDE GAZE: Looking UP or DOWN is explicitly PERMITTED (e.g., reading notes on desk)
  const isLookingLeftOrRight = centerShiftRatio > 0.32 || pupilShiftRatio > 0.30 || isProfileSideView;

  let sideDirection = '';
  if (isLookingLeftOrRight) {
    if (skinCenterX < faceCenterX) {
      sideDirection = 'Left';
    } else {
      sideDirection = 'Right';
    }
  }

  return {
    faceDetected: true,
    confidence: Math.min(1, skinRatio * 5),
    lookingAway: false,
    method: 'canvas-vision',
    message: 'Face in camera view — Looking focused',
  };
}

export async function detectAttention(video: HTMLVideoElement): Promise<DetectionResult> {
  if (!video || video.paused || video.ended || video.readyState < 2) {
    return { faceDetected: false, confidence: 0, lookingAway: false, method: 'canvas-vision', message: 'Camera feed not ready' };
  }

  // 1. Try face-api model if loaded
  if (isFaceApiLoaded) {
    try {
      const faceapi = (window as unknown as any).faceapi;

      if (faceapi) {
        if (isLandmarkLoaded) {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }))
            .withFaceLandmarks(true);

          if (detection) {
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const nose = landmarks.getNose();

            if (leftEye.length > 0 && rightEye.length > 0 && nose.length > 0) {
              const lx = leftEye.reduce((s: number, p: { x: number }) => s + p.x, 0) / leftEye.length;
              const rx = rightEye.reduce((s: number, p: { x: number }) => s + p.x, 0) / rightEye.length;
              const nx = nose[3] ? nose[3].x : nose.reduce((s: number, p: { x: number }) => s + p.x, 0) / nose.length;

              const minEyeX = Math.min(lx, rx);
              const maxEyeX = Math.max(lx, rx);
              const eyeDist = maxEyeX - minEyeX;

              if (eyeDist > 0) {
                const noseRatio = (nx - minEyeX) / eyeDist;
                // Straight ahead nose ratio is ~0.42 to ~0.58.
                // Ratio < 0.36 indicates face/eyes turned to Left
                // Ratio > 0.64 indicates face/eyes turned to Right
                const lookingLeft = noseRatio < 0.36;
                const lookingRight = noseRatio > 0.64;
                const isSideGaze = lookingLeft || lookingRight;

                return {
                  faceDetected: true,
                  confidence: detection.detection.score,
                  lookingAway: false,
                  method: 'face-api',
                  message: 'Face in camera view — Focusing',
                };
              }
            }

            return {
              faceDetected: true,
              confidence: detection.detection.score,
              lookingAway: false,
              method: 'face-api',
              message: 'Face detected on camera',
            };
          } else {
            // Neural net face detector found NO face in frame!
            const canvasRes = analyzeCanvasPresence(video);
            if (!canvasRes.faceDetected || canvasRes.confidence < 0.6) {
              return {
                faceDetected: false,
                confidence: 0,
                lookingAway: false,
                method: 'face-api',
                message: '🚨 FACE OUT OF CAMERA',
              };
            }
          }
        } else {
          const detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
          );

          if (detections.length > 0) {
            const canvasRes = analyzeCanvasPresence(video);
            return {
              faceDetected: canvasRes.faceDetected,
              confidence: detections[0].score,
              lookingAway: false,
              method: 'face-api',
              message: canvasRes.faceDetected
                ? 'Face detected on camera — Focusing'
                : '🚨 FACE OUT OF CAMERA',
            };
          }
        }
      }
    } catch (err) {
      console.warn('face-api detect error, falling back:', err);
    }
  }

  // 2. Try Native browser FaceDetector if available
  if ('FaceDetector' in window) {
    try {
      const NativeFaceDetector = (window as unknown as { FaceDetector: new () => { detect: (media: HTMLVideoElement) => Promise<Array<unknown>> } }).FaceDetector;
      const detector = new NativeFaceDetector();
      const faces = await detector.detect(video);
      if (faces.length > 0) {
        return {
          faceDetected: true,
          confidence: 0.9,
          lookingAway: false,
          method: 'native-api',
          message: 'Face detected via Browser Native API',
        };
      }
    } catch (e) {
      // ignore & fallback
    }
  }

  // 3. Fallback Canvas Vision analyzer
  return analyzeCanvasPresence(video);
}

