
import { WallSide, WallConfig } from './types';

// Approximate dimensions of Rivera Court in feet-scaled units
// Refined to a 1.5:1 ratio (66x44) to match the provided floor image proportions
export const ROOM_WIDTH = 66;
export const ROOM_DEPTH = 44;
export const ROOM_HEIGHT = 38;

export const EYE_LEVEL = 6.0;
export const MAX_LIFT = 30.0;

export const MOVEMENT_SPEED = 0.22;
export const LOOK_SENSITIVITY = 0.0018;
export const COLLISION_BUFFER = 7.0;

export const FLOOR_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Ffloor.png?alt=media&token=cefeca04-973d-46a1-90b2-293f02a112aa';
export const CEILING_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Fceiling.png?alt=media&token=8b5b06bd-1cc3-4618-a532-e0fe5839ceef';

/** 
 * Mural Wall Configuration
 * Using Cloudinary URLs for all four walls.
 * Dimensions are automatically updated based on ROOM_WIDTH and ROOM_DEPTH.
 */
export const WALLS: WallConfig[] = [
  {
    side: WallSide.NORTH,
    imageUrl: '/NorthWall11.png',
    lowResUrl: '/NorthWall11.png',
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    position: [0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2],
    rotation: [0, 0, 0]
  },
  {
    side: WallSide.SOUTH,
    imageUrl: '/SouthWall11.png',
    lowResUrl: '/SouthWall11.png',
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    position: [0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2],
    rotation: [0, Math.PI, 0]
  },
  {
    side: WallSide.EAST,
    imageUrl: '/EastWall11.png',
    lowResUrl: '/EastWall11.png',
    width: ROOM_DEPTH,
    height: ROOM_HEIGHT,
    position: [ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    rotation: [0, -Math.PI / 2, 0]
  },
  {
    side: WallSide.WEST,
    imageUrl: '/WestWall22.png',
    lowResUrl: '/WestWall22.png',
    width: ROOM_DEPTH,
    height: ROOM_HEIGHT,
    position: [-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    rotation: [0, Math.PI / 2, 0]
  }
];
