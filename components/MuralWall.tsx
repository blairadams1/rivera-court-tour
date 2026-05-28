
import React, { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WallConfig } from '../types';
import { loadTextureCached } from '../textureCache';

interface MuralWallProps {
  config: WallConfig;
}

const MuralWall: React.FC<MuralWallProps> = ({ config }) => {
  const { gl } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadTextureCached(config.imageUrl, gl)
      .then((tex) => {
        setTexture(tex);
        setError(false);
      })
      .catch((err) => {
        console.error("Cached Texture Load Failed:", config.imageUrl, err);
        setError(true);
        // Fallback to low-res
        loadTextureCached(config.lowResUrl, gl)
          .then((lowTex) => {
            setTexture(lowTex);
          })
          .catch((fallbackErr) => {
            console.error("Fallback Texture Load Failed:", config.lowResUrl, fallbackErr);
          });
      });
  }, [config.imageUrl, config.lowResUrl, gl]);

  return (
    <mesh position={config.position} rotation={config.rotation} renderOrder={100}>
      <planeGeometry args={[config.width, config.height]} />
      {/* 
        Using meshBasicMaterial instead of meshStandardMaterial.
        This makes the material "unlit", so it renders the texture exactly 
        as the original PNG without being affected by scene lights.
        renderOrder={100} on the mesh ensures main walls draw on top of placed/interior walls.
      */}
      <meshBasicMaterial 
        map={texture} 
        transparent={config.imageUrl.toLowerCase().endsWith('.png')}
        alphaTest={0.1}
        side={THREE.DoubleSide}
        color={texture ? "white" : (error ? "#333333" : "#111111")}
      />
    </mesh>
  );
};

export default MuralWall;
