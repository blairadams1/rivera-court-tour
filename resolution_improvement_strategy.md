# Strategy for Improving Mural Resolution

This document outlines the strategy to eliminate pixelation when users get close to the mural walls in the Rivera Court 3D Explorer.

## The Problem: "Texture Stretching"
Even with 10MB+ images, WebGL has a **Hardware Texture Limit** (typically 4096px or 8192px). 
- A 66-foot wall rendered with a single 4096px texture gives only ~62 pixels per foot.
- When the camera is 5 feet away, the "visual resolution" is very low, causing pixelation.

## Recommended Solution: Multi-Resolution Tiling (LOD Tiles)

The most effective strategy is to split each large wall into a grid of smaller, high-resolution textures. This is how Google Maps and gigapixel viewers maintain clarity.

### 1. Image Processing (The Grid)
- **Slice each wall** into a grid (e.g., 4x3 or 6x4 tiles).
- Each tile should be roughly **1024x1024** or **2048x2048**.
- For a 6x4 grid of 2048px tiles, the effective resolution becomes **12,288 x 8,192 px**.

### 2. Implementation Steps
- **Hosting**: Upload the individual tiles to Cloudinary or Firebase Storage.
- **Component Update (`MuralWall.tsx`)**: 
    - Instead of one `<mesh>` per wall, render a grid of smaller `<mesh>` planes.
    - Each plane loads its specific tile texture.
- **LOD (Level of Detail)**:
    - Keep a single low-res "Full Wall" texture as a background.
    - Only load the high-res tiles when the camera is within a certain distance of the wall.

### 3. Quick Wins (Immediate Code Tweaks)
- **Improve Filtering**: Change `tex.minFilter` from `THREE.LinearFilter` to `THREE.LinearMipmapLinearFilter` in `MuralWall.tsx`. This enables mipmapping for smoother transitions.
- **Check Cloudinary Transforms**: Ensure Cloudinary isn't automatically downscaling your PNGs. You can force high quality using URI parameters if needed.

## Why this works
By breaking the wall into 24 pieces (6x4 grid), the GPU treats each piece as a separate texture. You bypass the single-texture hardware limit and achieve "magazine quality" detail even when the user stands right in front of the art.
