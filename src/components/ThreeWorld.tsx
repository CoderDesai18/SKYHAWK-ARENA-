import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { sampleTrainingContact, type ThreatBehavior } from '../lib/threatEngine';

export interface WorldPosition { x: number; z: number; altitude: number; heading: number; }
export interface WorldWaypoint { x: number; z: number; label?: string; }
interface Props {
  mode: 'operator' | 'defender' | 'showcase';
  position?: WorldPosition;
  threatCount?: number;
  threatBehaviors?: ThreatBehavior[];
  waypoints?: WorldWaypoint[];
  activeWaypoint?: number;
  quality?: 'LOW' | 'MEDIUM' | 'HIGH';
  seed?: number;
  className?: string;
}

function randFactory(seed = 1) {
  let value = (seed >>> 0) || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function makeDrone(color: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .4, metalness: .42, emissive: color, emissiveIntensity: .08 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14212d, roughness: .72, metalness: .18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1 * scale, .34 * scale, 1.42 * scale), bodyMat);
  body.position.y = 0;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.25 * scale, .62 * scale, 4), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -.93 * scale;
  group.add(nose);
  const rotorGroups: THREE.Group[] = [];
  const arms = [[-.95, -.76], [.95, -.76], [-.95, .76], [.95, .76]];
  arms.forEach(([x, z]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.13 * scale, .12 * scale, .85 * scale), darkMat);
    arm.position.set(x * .52, .05 * scale, z * .52);
    arm.rotation.y = x === z ? Math.PI / 4 : -Math.PI / 4;
    group.add(arm);
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(x, .22 * scale, z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.12 * scale, .12 * scale, .12 * scale, 8), bodyMat);
    rotorGroup.add(hub);
    const disc = new THREE.Mesh(new THREE.TorusGeometry(.48 * scale, .018 * scale, 4, 16), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: .62 }));
    disc.rotation.x = Math.PI / 2;
    rotorGroup.add(disc);
    group.add(rotorGroup);
    rotorGroups.push(rotorGroup);
  });
  const light = new THREE.PointLight(color, 1.3, 8);
  light.position.set(0, .3, -.6);
  group.add(light);
  group.userData.rotors = rotorGroups;
  return group;
}

function makeContact(color: number, index: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0), new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .25, emissive: color, emissiveIntensity: .48 }));
  body.scale.set(1.1, .55, 1.5);
  group.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 + index * .08, .025, 6, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72 }));
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const light = new THREE.PointLight(color, .7, 5);
  light.position.y = .5;
  group.add(light);
  return group;
}

export default function ThreeWorld({ mode, position, threatCount = 2, threatBehaviors, waypoints = [], activeWaypoint = 0, quality = 'MEDIUM', seed = 31, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef({ mode, position: position ?? { x: 0, z: 0, altitude: 60, heading: 0 }, threatCount, threatBehaviors, waypoints, activeWaypoint, quality, seed });
  const [failed, setFailed] = useState(false);
  currentRef.current = { mode, position: position ?? { x: 0, z: 0, altitude: 60, heading: 0 }, threatCount, threatBehaviors, waypoints, activeWaypoint, quality, seed };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    let animation = 0;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111c27);
    scene.fog = new THREE.FogExp2(0x111c27, .009);
    const startMode = currentRef.current.mode;
    const camera = new THREE.PerspectiveCamera(52, host.clientWidth / Math.max(host.clientHeight, 1), .1, 450);
    camera.position.set(0, startMode === 'defender' ? 56 : 10, startMode === 'defender' ? 27 : 16);
    camera.lookAt(0, 0, 0);
    const low = currentRef.current.quality === 'LOW';
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentRef.current.quality === 'HIGH' ? 1.8 : 1.3));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = false;
      host.appendChild(renderer.domElement);
    } catch (error) {
      console.warn('3D simulation renderer failed to initialize.', error);
      setFailed(true);
      return;
    }
    setFailed(false);
    const ambient = new THREE.HemisphereLight(0x8db8c9, 0x263628, 1.8);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xc0e6ff, 2.3);
    sun.position.set(-28, 42, 26);
    scene.add(sun);
    const accent = new THREE.DirectionalLight(0x39bad1, .45);
    accent.position.set(16, 16, -24);
    scene.add(accent);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x26392f, roughness: .96, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.18;
    scene.add(ground);
    const grid = new THREE.GridHelper(220, 55, 0x4f7c82, 0x3d6269);
    grid.position.y = -.13;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { (material as THREE.Material & { opacity?: number; transparent?: boolean }).transparent = true; (material as THREE.Material & { opacity?: number }).opacity = .13; });
    scene.add(grid);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x293138, roughness: 1 });
    const road = new THREE.Mesh(new THREE.BoxGeometry(5.2, .06, 102), roadMat);
    road.position.set(-19, -.08, -28);
    scene.add(road);
    const road2 = new THREE.Mesh(new THREE.BoxGeometry(102, .06, 4.4), roadMat);
    road2.position.set(15, -.07, 20);
    scene.add(road2);
    for (let i = 0; i < 15; i += 1) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.13, .025, 2.1), new THREE.MeshBasicMaterial({ color: 0xb6c4b7, transparent: true, opacity: .38 }));
      dash.position.set(-19, -.035, -72 + i * 6);
      scene.add(dash);
    }

    const random = randFactory(currentRef.current.seed);
    const buildingMaterial = [0x34434a, 0x3b4647, 0x49524e, 0x303b42].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .86 }));
    const buildings = currentRef.current.mode === 'showcase' ? 14 : 21;
    for (let i = 0; i < buildings; i += 1) {
      const x = (random() - .5) * 82;
      const z = (random() - .5) * 75 - 13;
      if (Math.abs(x) < 8 && Math.abs(z) < 12) continue;
      const h = 2.8 + random() * (currentRef.current.mode === 'showcase' ? 8 : 11);
      const w = 3 + random() * 4;
      const d = 3 + random() * 4;
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial[Math.floor(random() * buildingMaterial.length)]);
      block.position.set(x, h / 2 - .1, z);
      scene.add(block);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + .16, .2, d + .16), new THREE.MeshStandardMaterial({ color: 0x61716d, roughness: .8 }));
      roof.position.set(x, h - .12, z);
      scene.add(roof);
      if (i % 2 === 0) {
        const windowLine = new THREE.Mesh(new THREE.BoxGeometry(w * .72, .1, .04), new THREE.MeshBasicMaterial({ color: 0x9bb5ae, transparent: true, opacity: .23 }));
        windowLine.position.set(x, Math.max(1, h * .62), z + d / 2 + .025);
        scene.add(windowLine);
      }
    }

    const treeCount = currentRef.current.quality === 'LOW' ? 22 : 45;
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .24, 1.5, 5), new THREE.MeshStandardMaterial({ color: 0x514336, roughness: 1 }), treeCount);
    const canopyMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.35, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0x334a3b, roughness: 1 }), treeCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i += 1) {
      const x = (random() - .5) * 98;
      const z = (random() - .5) * 96;
      if (Math.abs(x) < 9 && z > -32 && z < 8) { dummy.position.set(45 + random() * 10, 0, z); }
      else dummy.position.set(x, 0, z);
      const scale = .7 + random() * .75;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 2.15 * scale;
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i, dummy.matrix);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh, canopyMesh);

    const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x3c5047, roughness: 1 });
    for (let i = 0; i < 8; i += 1) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(7 + random() * 8, 12 + random() * 14, 5), hillMaterial);
      mountain.position.set(-70 + i * 19, 2.7, -73 - random() * 18);
      mountain.rotation.y = random() * 2;
      scene.add(mountain);
    }

    const zoneCenter = new THREE.Vector3(14, .02, -19);
    const zone = new THREE.Mesh(new THREE.RingGeometry(9.1, 9.45, 52), new THREE.MeshBasicMaterial({ color: 0xd88a45, transparent: true, opacity: .48, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.copy(zoneCenter);
    scene.add(zone);
    const zoneInner = new THREE.Mesh(new THREE.CircleGeometry(9.1, 52), new THREE.MeshBasicMaterial({ color: 0x9c5c30, transparent: true, opacity: .055, side: THREE.DoubleSide }));
    zoneInner.rotation.x = -Math.PI / 2;
    zoneInner.position.copy(zoneCenter);
    scene.add(zoneInner);
    const zoneTag = new THREE.Mesh(new THREE.BoxGeometry(5.1, .08, .07), new THREE.MeshBasicMaterial({ color: 0xf2a25d, transparent: true, opacity: .74 }));
    zoneTag.position.set(14, .09, -28.6);
    scene.add(zoneTag);

    const drone = makeDrone(0x54d9e9, currentRef.current.mode === 'showcase' ? 1.15 : .86);
    scene.add(drone);
    const contacts: THREE.Group[] = [];
    for (let i = 0; i < 5; i += 1) {
      const contact = makeContact(i % 2 === 0 ? 0xf2a25b : 0xe76665, i);
      contact.visible = i < currentRef.current.threatCount;
      scene.add(contact);
      contacts.push(contact);
    }

    const waypointObjects: THREE.Group[] = [];
    const createWaypoint = (color: number) => {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .075, 7, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 }));
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3.8, 7), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .3 }));
      beacon.position.y = 1.9;
      marker.add(beacon);
      const glow = new THREE.PointLight(color, .8, 9);
      glow.position.y = .9;
      marker.add(glow);
      scene.add(marker);
      return marker;
    };
    const defaultWaypoints = [{ x: 0, z: -12 }, { x: 10, z: -26 }];
    const initWaypoints = currentRef.current.waypoints.length ? currentRef.current.waypoints : defaultWaypoints;
    initWaypoints.forEach((point, i) => {
      const marker = createWaypoint(i === currentRef.current.activeWaypoint ? 0x53dce7 : 0x879ca4);
      marker.position.set(point.x, .06, point.z);
      waypointObjects.push(marker);
    });

    const cameraLook = { x: 0, y: 0 };
    const handlePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      cameraLook.x = ((event.clientX - rect.left) / rect.width - .5) * 1.4;
      cameraLook.y = ((event.clientY - rect.top) / rect.height - .5) * .35;
    };
    host.addEventListener('pointermove', handlePointer);
    const clock = new THREE.Clock();
    const target = new THREE.Vector3();
    const desiredCam = new THREE.Vector3();
    const animate = () => {
      if (disposed) return;
      animation = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const state = currentRef.current;
      const pos = state.position;
      let droneX = pos.x;
      let droneZ = pos.z;
      let heading = pos.heading * Math.PI / 180;
      let altitude = pos.altitude;
      if (state.mode === 'showcase') {
        droneX = Math.sin(elapsed * .21) * 8;
        droneZ = -6 - Math.cos(elapsed * .18) * 6;
        heading = Math.sin(elapsed * .15) * .22;
        altitude = 92 + Math.sin(elapsed * .55) * 3;
      }
      drone.position.set(droneX, 2.1 + (altitude - 60) * .028, droneZ);
      drone.rotation.set(Math.sin(heading) * .035, heading, Math.cos(heading) * .045);
      (drone.userData.rotors as THREE.Group[]).forEach((rotor, i) => { rotor.rotation.y = elapsed * (i % 2 ? -18 : 18); });

      contacts.forEach((contact, i) => {
        contact.visible = i < state.threatCount;
        const sample = sampleTrainingContact(state.threatBehaviors?.[i] ?? 'PATROL', i, elapsed, state.seed);
        contact.position.set(sample.x, sample.y, sample.z);
        contact.rotation.y = elapsed * (i % 2 ? -.4 : .32);
      });
      waypointObjects.forEach((point, i) => {
        const active = i === state.activeWaypoint;
        const marker = point.children[0] as THREE.Mesh;
        const mat = marker.material as THREE.MeshBasicMaterial;
        if (active) {
          const pulse = .85 + Math.sin(elapsed * 3) * .1;
          point.scale.setScalar(pulse);
          mat.opacity = .85;
        } else { point.scale.setScalar(.74); mat.opacity = .45; }
      });

      if (state.mode === 'defender') {
        desiredCam.set(cameraLook.x * 6, 55 + cameraLook.y * 7, 26);
        target.set(0, 0, -7);
        camera.position.lerp(desiredCam, .025);
        camera.lookAt(target);
      } else {
        const followDistance = state.mode === 'showcase' ? 17 : 13;
        desiredCam.set(droneX - Math.sin(heading + cameraLook.x * .4) * followDistance, drone.position.y + 7.5 - cameraLook.y * 7, droneZ + Math.cos(heading + cameraLook.x * .4) * followDistance);
        target.set(droneX + Math.sin(heading) * 7, drone.position.y + 1.6, droneZ - Math.cos(heading) * 8);
        camera.position.lerp(desiredCam, state.mode === 'showcase' ? .035 : .085);
        camera.lookAt(target);
      }
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentRef.current.quality === 'HIGH' ? 1.8 : 1.3));
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      host.removeEventListener('pointermove', handlePointer);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className={`world-canvas ${className}`} ref={hostRef}>
    {failed && <div className="webgl-fallback"><span>3D VIEWPORT UNAVAILABLE</span><p>Enable WebGL or lower graphics quality to load the local training terrain.</p><button onClick={() => window.location.reload()}>RETRY VIEWPORT</button></div>}
    {!failed && <div className="world-canvas-vignette" />}
  </div>;
}
