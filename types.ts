
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
}
