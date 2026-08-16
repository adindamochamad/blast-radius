import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const BONE = new THREE.Color("#ede6d8");
const TRACE = new THREE.Color("#4be0c4");
const SIGNAL = new THREE.Color("#ff4d1c");

function fibSphere(n: number, r: number) {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push(
      new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad).multiplyScalar(r)
    );
  }
  return pts;
}

function Graph() {
  const group = useRef<THREE.Group>(null);
  const N = 320;

  const { pointsGeo, lineGeo, colors } = useMemo(() => {
    const pts = fibSphere(N, 2.15);
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const signalIdx = 0;
    pts.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3);
      const c = i === signalIdx ? SIGNAL : BONE;
      colors.set([c.r, c.g, c.b], i * 3);
    });
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // connect each point to a few nearest neighbours
    const linePos: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = pts[i];
      const dists = pts
        .map((p, j) => ({ j, d: a.distanceTo(p) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const { j } of dists) {
        linePos.push(a.x, a.y, a.z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(linePos), 3)
    );
    return { pointsGeo, lineGeo, colors };
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.06;
    const { x, y } = state.pointer;
    group.current.rotation.x += (y * 0.3 - group.current.rotation.x) * 0.03;
    group.current.rotation.z += (-x * 0.15 - group.current.rotation.z) * 0.03;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial
          color={TRACE}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={pointsGeo}>
        <pointsMaterial
          size={0.055}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.9}
        />
      </points>
    </group>
  );
}

export default function HeroGraph() {
  return (
    <Canvas
      className="hero-canvas"
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Graph />
    </Canvas>
  );
}
