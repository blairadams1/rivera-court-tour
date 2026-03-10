
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
  WEST = 'WEST'
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

export interface Hotspot {
  id: string;
  title: string;
  description: string;
  wallSide: WallSide;
  position: [number, number, number]; // World space
  mediaType: MediaType;
  mediaUrl?: string;
}
