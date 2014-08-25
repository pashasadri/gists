vec3 calculateWorldSpacePosition(const in float depth, const in vec2 uv, const in vec3 cameraPositionWorldSpace) {
  vec3 lerpSBottom = mix(vCameraFarPlaneWorld0, vCameraFarPlaneWorld1, uv.s);
  vec3 lerpSTop = mix(vCameraFarPlaneWorld2, vCameraFarPlaneWorld3, uv.s);
  vec3 lerpT = mix(lerpSBottom, lerpSTop, uv.t);

  return normalize(lerpT) * depth + cameraPositionWorldSpace;
}

vec4 shadeWeights(const in float shading) {
  vec4 shadingFactor = vec4(shading);

  const vec4 leftRoot = vec4(-0.25, 0.0, 0.25, 0.5);
  const vec4 rightRoot = vec4(0.25, 0.5, 0.75, 1.0);

  return clamp(shadingFactor - leftRoot, vec4(0.0), rightRoot - shadingFactor);
}

void main() {
  float uvDist = 1.0;
  uvDist = min(vUV.s, uvDist);
  uvDist = min(vUV.t, uvDist);
  uvDist = min(1.0 - vUV.s, uvDist);
  uvDist = min(1.0 - vUV.t, uvDist);

  float smallAmplitude = 0.005;
  float largeAmplitude = 0.01;
  largeAmplitude *= uvDist;
  smallAmplitude *= uvDist;

  vec2 perturbedUV = texture2D(warpVectorFieldTexture, vUV * 2.0).xy * vec2(smallAmplitude);
  perturbedUV += texture2D(warpVectorFieldTexture, vUV * 0.3).xy * vec2(largeAmplitude);
  perturbedUV += vUV;

  gBufferGeomComponents buffer = decodeGBufferGeom(camera_uGBuffer, perturbedUV, camera_uClipFar);
  if (buffer.depth >= camera_uClipFar) {
    discard;
  }

  vec3 worldPosition = calculateWorldSpacePosition(buffer.depth, perturbedUV, camera_uPosition);
  vec3 normalWorldSpace = buffer.normal * mat3(camera_uViewMatrix);
  float shading = texture2D(shadingPass, perturbedUV).r;

  vec3 uvwA = worldPosition * 2.0;
  vec3 uvwB = worldPosition * -3.7;

  vec4 hatchLutXA = texture2D(hatchLut, uvwA.yz).abgr;
  vec4 hatchLutYA = texture2D(hatchLut, uvwA.xz).abgr;
  vec4 hatchLutZA = texture2D(hatchLut, uvwA.xy).abgr;

  vec4 hatchLutXB = texture2D(hatchLut, uvwB.zy).abgr;
  vec4 hatchLutYB = texture2D(hatchLut, uvwB.zx).abgr;
  vec4 hatchLutZB = texture2D(hatchLut, uvwB.yx).abgr;

  vec4 shadingWeights = shadeWeights(shading);
  float whiteWeight = max(0.0, shading - 0.75) * 4.0;

  vec3 hatching = vec3(
    (dot(shadingWeights, hatchLutXA) + whiteWeight) * (dot(shadingWeights, hatchLutXB) + whiteWeight),
    (dot(shadingWeights, hatchLutYA) + whiteWeight) * (dot(shadingWeights, hatchLutYB) + whiteWeight),
    (dot(shadingWeights, hatchLutZA) + whiteWeight) * (dot(shadingWeights, hatchLutZB) + whiteWeight)
  );

  float hatchedShading = dot(hatching, normalWorldSpace * normalWorldSpace);

  gl_FragColor = vec4(vec3(mix(shading, 1.0, hatchedShading)), 1.0);
}

