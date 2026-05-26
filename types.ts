
export interface CameraState {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
}

export enum WallSide {
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
  EAST = 'EAST',
  WEST = 'WEST',
  FLOOR = 'FLOOR'
}

export interface WallConfig {
  side: WallSide;
  imageUrl: string;
  lowResUrl: string;
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
}

export type MediaType = 'image' | 'video' | 'audio' | 'none';

export interface GalleryImage {
  id: string;
  url: string;
  caption: string;
}

export interface Hotspot {
  id: string;
  title: string;
  description: string;
  wallSide: WallSide;
  position: [number, number, number]; // World space
  mediaType: MediaType;
  mediaUrl?: string; // Kept for backwards compatibility / single media
  gallery?: GalleryImage[];
}

export type PlacedWallType = 'wall' | 'floor' | 'ceiling';

export interface InteriorWall {
  id: string;
  type: PlacedWallType;       // 'wall' = vertical, 'floor' = horizontal at ground, 'ceiling' = horizontal at top
  imageUrl: string;            // Firebase Storage download URL
  position: [number, number, number]; // world XYZ center
  rotation: [number, number, number]; // [X, Y, Z] rotation in degrees
  scale: [number, number];     // [width, height] in feet-units
  label: string;               // admin-only label
  billboard?: boolean;         // if true, plane always faces camera (Y-axis only)
  renderOrder?: number;        // draw order for overlapping panels (higher = on top)
}

/** Per-face texture URLs for a PlacedBox. Three.js BoxGeometry face order: [+X,-X,+Y,-Y,+Z,-Z] */
export interface BoxFaceTextures {
  right?: string;    // +X face
  left?: string;     // -X face
  top?: string;      // +Y face
  bottom?: string;   // -Y face
  front?: string;    // +Z face
  back?: string;     // -Z face
}

export interface InteriorBox {
  id: string;
  position: [number, number, number];       // world XYZ center
  rotation: [number, number, number];       // [X, Y, Z] rotation in degrees
  scale: [number, number, number];          // [width, height, depth] in feet
  label: string;
  textureMode: 'uniform' | 'per-face';
  textureUrl?: string;                      // used when textureMode is 'uniform'
  faceTextures?: BoxFaceTextures;           // used when textureMode is 'per-face'
  color?: string;                           // fallback solid color (default '#cccccc')
  renderOrder?: number;
}

/** Per-face texture URLs for a PlacedCylinder. CylinderGeometry material order: [side, top, bottom] */
export interface CylinderFaceTextures {
  side?: string;     // body wrap
  top?: string;      // top cap
  bottom?: string;   // bottom cap
}

export interface InteriorCylinder {
  id: string;
  position: [number, number, number];       // world XYZ center
  rotation: [number, number, number];       // [X, Y, Z] rotation in degrees
  scale: [number, number, number];          // [diameter, height, diameter] in feet
  label: string;
  segments?: number;                        // radial segments (default 32)
  textureMode: 'uniform' | 'per-face';
  textureUrl?: string;                      // used when textureMode is 'uniform'
  faceTextures?: CylinderFaceTextures;      // used when textureMode is 'per-face'
  color?: string;                           // fallback solid color (default '#cccccc')
  renderOrder?: number;
}
