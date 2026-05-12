
import React, { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WallConfig } from '../types';

interface MuralWallProps {
  config: WallConfig;
}

const MuralWall: React.FC<MuralWallProps> = ({ config }) => {
  const { gl } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    // Attempt loading high-res texture
    loader.load(
      config.imageUrl,
      (tex) => {
        tex.anisotropy = gl.capabilities.getMaxAnisotropy();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        setTexture(tex);
        setError(false);
      },
      undefined,
      (err) => {
        console.error("Texture Load Failed:", config.imageUrl, err);
        setError(true);
        // Fallback to low-res
        loader.load(config.lowResUrl, (lowTex) => {
          lowTex.colorSpace = THREE.SRGBColorSpace;
          setTexture(lowTex);
        });
      }
    );
  }, [config.imageUrl, config.lowResUrl, gl]);

  return (
    <mesh position={config.position} rotation={config.rotation} renderOrder={100}>
      <planeGeometry args={[config.width, config.height]} />
      {/* 
        Using meshBasicMaterial instead of meshStandardMaterial.
        This makes the material "unlit", so it renders the texture exactly 
        as the original PNG without being affected by scene lights.
        depthTest disabled so main walls always render on top of placed/interior walls.
      */}
      <meshBasicMaterial 
        map={texture} 
        transparent={config.imageUrl.toLowerCase().endsWith('.png')}
        alphaTest={0.1}
        side={THREE.DoubleSide}
        depthTest={false}
        color={texture ? "white" : (error ? "#333333" : "#111111")}
      />
    </mesh>
  );
};

export default MuralWall;
