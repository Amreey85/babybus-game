/**
 * Single place for Babylon.js imports. Deep imports keep the bundle small
 * (the package marks every file as having side effects, so the root index
 * would pull in the entire engine).
 */
export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Viewport } from '@babylonjs/core/Maths/math.viewport';
export { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
export { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
export { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
export { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
export { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
export { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
export { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
export { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
export { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { Material } from '@babylonjs/core/Materials/material';
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export { Texture } from '@babylonjs/core/Materials/Textures/texture';
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
export { GlowLayer } from '@babylonjs/core/Layers/glowLayer';

// Side-effect registrations.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/outlineRenderer';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import '@babylonjs/core/Culling/ray';
