"use client";

import { useEffect, useRef } from "react";

interface DitherProps {
  color?: [number, number, number];
}

export default function Dither({ color = [0.5, 0.5, 0.5] }: DitherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const colorRef = useRef<[number, number, number]>(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: 1.0 - e.clientY / window.innerHeight, // Flip Y for WebGL
      };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      console.warn("WebGL not supported, falling back to empty canvas");
      return;
    }

    // Vertex Shader
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment Shader matching user specs
    const fsSource = `
      precision highp float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec3 uColor;
      uniform float uColorIntensity;
      uniform float uWaveAmp;
      uniform float uWaveFreq;
      uniform float uWaveSpeed;
      uniform float uMouseRadius;

      // Pseudo-random noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      // Layered Noise (FBM)
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        // Rotate to reduce directional alignment
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.505));
        for (int i = 0; i < 3; ++i) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      // 4x4 Bayer Matrix
      float bayer(vec2 p) {
        int x = int(mod(p.x, 4.0));
        int y = int(mod(p.y, 4.0));
        
        if (x == 0 && y == 0) return 0.0 / 16.0;
        if (x == 1 && y == 0) return 8.0 / 16.0;
        if (x == 2 && y == 0) return 2.0 / 16.0;
        if (x == 3 && y == 0) return 10.0 / 16.0;
        
        if (x == 0 && y == 1) return 12.0 / 16.0;
        if (x == 1 && y == 1) return 4.0 / 16.0;
        if (x == 2 && y == 1) return 14.0 / 16.0;
        if (x == 3 && y == 1) return 6.0 / 16.0;
        
        if (x == 0 && y == 2) return 3.0 / 16.0;
        if (x == 1 && y == 2) return 11.0 / 16.0;
        if (x == 2 && y == 2) return 1.0 / 16.0;
        if (x == 3 && y == 2) return 9.0 / 16.0;
        
        if (x == 0 && y == 3) return 15.0 / 16.0;
        if (x == 1 && y == 3) return 7.0 / 16.0;
        if (x == 2 && y == 3) return 13.0 / 16.0;
        if (x == 3 && y == 3) return 5.0 / 16.0;
        
        return 0.0;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        
        // Calculate mouse wave deformation
        vec2 mouseDir = uv - uMouse;
        mouseDir.x *= uResolution.x / uResolution.y; // Correct aspect ratio
        float mouseDist = length(mouseDir);
        float mousePush = smoothstep(uMouseRadius, 0.0, mouseDist);
        
        // Displaced coordinates
        vec2 waveUv = uv * uWaveFreq;
        waveUv += mouseDir * mousePush * 0.5; // Push away from cursor
        
        // Liquid animation using time and multi-octave FBM
        float t = uTime * uWaveSpeed;
        float n1 = fbm(waveUv + vec2(t, t * 0.5));
        float n2 = fbm(waveUv * 1.6 - vec2(t * 0.8, -t) + n1);
        float liquidVal = mix(n1, n2, 0.5) * uWaveAmp;
        
        // Scale and apply color intensity
        float intensity = liquidVal * uColorIntensity;
        
        // Dither comparison
        float limit = bayer(gl_FragCoord.xy);
        
        vec3 finalColor = vec3(0.0);
        if (intensity > limit) {
          finalColor = uColor;
        }
        
        // Darken borders slightly
        float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        vignette = clamp(pow(16.0 * vignette, 0.25), 0.0, 1.0);
        finalColor *= vignette;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Helper: Compile Shader
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    // Link Program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Quad Geometry
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Retrieve uniform locations
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uColor = gl.getUniformLocation(program, "uColor");
    const uColorIntensity = gl.getUniformLocation(program, "uColorIntensity");
    const uWaveAmp = gl.getUniformLocation(program, "uWaveAmp");
    const uWaveFreq = gl.getUniformLocation(program, "uWaveFreq");
    const uWaveSpeed = gl.getUniformLocation(program, "uWaveSpeed");
    const uMouseRadius = gl.getUniformLocation(program, "uMouseRadius");

    // Set static uniforms
    gl.uniform3f(uColor, colorRef.current[0], colorRef.current[1], colorRef.current[2]);
    gl.uniform1f(uColorIntensity, 4.0);
    gl.uniform1f(uWaveAmp, 0.3);
    gl.uniform1f(uWaveFreq, 3.0);
    gl.uniform1f(uWaveSpeed, 0.05);
    gl.uniform1f(uMouseRadius, 0.3);

    // Handle resizing
    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Animation Loop
    let animationFrameId = 0;
    const startTime = performance.now();

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform3f(uColor, colorRef.current[0], colorRef.current[1], colorRef.current[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    // Cleanups
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
      style={{ mixBlendMode: "screen", opacity: 0.08 }}
    />
  );
}
