/**
 * Shared "premium cartoon" look: warm key light, cool sky fill, gentle
 * tone mapping, a soft vignette and aerial haze. Used by menus and stages.
 */
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color3, Color4, DirectionalLight, HemisphericLight, Scene } from './babylon';

export function applyLook(scene: Scene, hemi: HemisphericLight, sun: DirectionalLight, low: boolean): void {
  scene.clearColor = Color4.FromHexString('#8FD3FFFF');
  scene.ambientColor = new Color3(0.32, 0.33, 0.38);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#D6EEFF');
  scene.fogStart = 46;
  scene.fogEnd = 260;

  // Cool, bright sky fill with green bounce from the lawn.
  hemi.intensity = 0.72;
  hemi.diffuse = Color3.FromHexString('#EAF4FF');
  hemi.groundColor = Color3.FromHexString('#A9D98F');
  hemi.specular = new Color3(0.25, 0.25, 0.25);

  // Warm late-morning sun.
  sun.intensity = 0.95;
  sun.diffuse = Color3.FromHexString('#FFE8C4');
  sun.specular = Color3.FromHexString('#FFF6E6');

  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
  ip.exposure = 1.08;
  ip.contrast = 1.14;
  if (!low) {
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.4;
    ip.vignetteStretch = 0.6;
    ip.vignetteColor = new Color4(0.16, 0.12, 0.3, 0);
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  }
}
