
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
export const COLLISION_BUFFER = 11.0;

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
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Fnorth_wall_hd.png?alt=media&token=92c5c751-df5b-4853-b9de-46c91bf58288',
    lowResUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Fnorth_wall_hd.png?alt=media&token=92c5c751-df5b-4853-b9de-46c91bf58288',
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    position: [0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2],
    rotation: [0, 0, 0]
  },
  {
    side: WallSide.SOUTH,
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Fsouth_wall_hd.png?alt=media&token=8f8b4bb4-c30b-4c83-a074-fae650936e46',
    lowResUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Fsouth_wall_hd.png?alt=media&token=8f8b4bb4-c30b-4c83-a074-fae650936e46',
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    position: [0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2],
    rotation: [0, Math.PI, 0]
  },
  {
    side: WallSide.EAST,
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Feast_wall_4626.png?alt=media&token=e78d0662-38f4-4f71-a112-056762cb7818',
    lowResUrl: 'https://firebasestorage.googleapis.com/v0/b/rivera-court-mural-2451s.firebasestorage.app/o/mural_assets%2Feast_wall_4626.png?alt=media&token=e78d0662-38f4-4f71-a112-056762cb7818',
    width: ROOM_DEPTH,
    height: ROOM_HEIGHT,
    position: [ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    rotation: [0, -Math.PI / 2, 0]
  },
  {
    side: WallSide.WEST,
    imageUrl: '/WestWall4626c.png',
    lowResUrl: '/WestWall4626c.png',
    width: ROOM_DEPTH,
    height: ROOM_HEIGHT,
    position: [-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    rotation: [0, Math.PI / 2, 0]
  }
];
