// MediaPipe Face Mesh landmark indices for eyebrows
// Upper and lower edges define the full eyebrow shape for filling

// Left eyebrow (person's right)
export const LEFT_EYEBROW_UPPER = [70, 63, 105, 66, 107];
export const LEFT_EYEBROW_LOWER = [46, 53, 52, 65, 55];
export const LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];

// Right eyebrow
export const RIGHT_EYEBROW_UPPER = [300, 293, 334, 296, 336];
export const RIGHT_EYEBROW_LOWER = [276, 283, 282, 295, 285];
export const RIGHT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

// Face oval for bounding
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

export class FaceMeshDetector {
  constructor() {
    this.faceLandmarker = null;
  }

  async init() {
    const { FaceLandmarker, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm'
    );

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  }

  detect(videoEl) {
    if (!this.faceLandmarker) return [];
    const result = this.faceLandmarker.detectForVideo(videoEl, performance.now());
    return result.faceLandmarks || [];
  }
}
