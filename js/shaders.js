export const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;

varying vec2 vUv;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 st = vUv;
    
    // Parallax effect based on mouse (subtle)
    vec2 mouseOffset = (uMouse - 0.5) * 0.05;
    
    // Fluid motion - Slower and larger scale
    // Increased scale slightly to show more "flow"
    // Add mouse interaction: distort the domain based on mouse position
    float mouseDist = distance(st, uMouse);
    float distortion = smoothstep(0.5, 0.0, mouseDist) * 0.2; // Stronger distortion near mouse
    
    float noise1 = snoise(st * 0.8 + uTime * 0.05 + mouseOffset + distortion);
    
    // Secondary noise for some texture variation, but still soft
    float noise2 = snoise(st * 1.5 - uTime * 0.08 - distortion * 0.5);
    
    // Deep, atmospheric colors with Teal/Cyan influence
    // Tuned darker as requested
    vec3 colorBg = vec3(0.01, 0.02, 0.03); // Very Dark Base
    vec3 colorGrad1 = vec3(0.15, 0.40, 0.45); // #408F98 (Teal) - Dimmed slightly
    vec3 colorGrad2 = vec3(0.05, 0.15, 0.20); // Darker Teal variation
    
    // Mix based on noise, but keep it very smooth
    // Map noise from [-1, 1] to [0, 1]
    float n1 = noise1 * 0.5 + 0.5;
    float n2 = noise2 * 0.5 + 0.5;
    
    // Use n1 to drive the main gradient flow
    // Increased visibility of the gradient
    vec3 finalColor = mix(colorBg, colorGrad1, smoothstep(0.3, 0.9, n1) * 0.5); // Reduced intensity
    finalColor = mix(finalColor, colorGrad2, n2 * 0.3); // Blend in second color gently
    
    // Frosted glass grain (High frequency noise)
    float grain = fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453);
    
    // Add grain, but keep it subtle
    finalColor += grain * 0.03;

    // Vignette (softer to avoid darkening too much)
    float vignetteDist = distance(st, vec2(0.5));
    finalColor *= smoothstep(1.4, 0.3, vignetteDist); // Much softer vignette

    gl_FragColor = vec4(finalColor, 1.0);
}
`;
