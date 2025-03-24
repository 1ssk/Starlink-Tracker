import { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import './App.css';

function Earth({ timeScale }) {
  const earthRef = useRef();

  useFrame(({ clock }) => {
    // Вращение Земли с учётом ускорения времени (1 оборот за 24 часа в реальном времени)
    const elapsedTime = clock.getElapsedTime() * timeScale; // Время в секундах с ускорением
    earthRef.current.rotation.y = (2 * Math.PI * elapsedTime) / (24 * 60 * 60);
  });

  return (
    <mesh ref={earthRef}>
      <sphereGeometry args={[5, 64, 64]} />
      <meshStandardMaterial
        map={new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg')}
        bumpMap={new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_bump_2048.jpg')}
        bumpScale={0.05}
      />
    </mesh>
  );
}

function Sun({ timeScale }) {
  const sunRef = useRef();
  const lightRef = useRef();
  const [startTime] = useState(Date.now());

  useFrame(() => {
    const currentTime = startTime + (Date.now() - startTime) * timeScale;
    const date = new Date(currentTime);
    const jd = getJulianDate(date);
    const sunPos = getSunPosition(jd);
    const distance = 50;

    const x = distance * Math.cos(sunPos.latitude) * Math.cos(sunPos.longitude);
    const y = distance * Math.sin(sunPos.latitude);
    const z = distance * Math.cos(sunPos.latitude) * Math.sin(sunPos.longitude);

    sunRef.current.position.set(x, y, z);
    lightRef.current.position.set(x, y, z);
  });

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
      <directionalLight
        ref={lightRef}
        color="#ffffff"
        intensity={1.5}
        castShadow
      />
    </group>
  );
}

function Moon({ timeScale }) {
  const moonRef = useRef();
  const [startTime] = useState(Date.now());

  useFrame(() => {
    const currentTime = startTime + (Date.now() - startTime) * timeScale;
    const date = new Date(currentTime);
    const jd = getJulianDate(date);
    const moonPos = getMoonPosition(jd);
    const distance = 10;

    const x = distance * Math.cos(moonPos.latitude) * Math.cos(moonPos.longitude);
    const y = distance * Math.sin(moonPos.latitude);
    const z = distance * Math.cos(moonPos.latitude) * Math.sin(moonPos.longitude);

    moonRef.current.position.set(x, y, z);
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        map={new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/moon_1024.jpg')}
      />
    </mesh>
  );
}

function Satellites({ tleData, timeScale }) {
  const meshRef = useRef();
  const [startTime] = useState(Date.now());

  useFrame(() => {
    if (!meshRef.current) return;

    const currentTime = startTime + (Date.now() - startTime) * timeScale;
    const date = new Date(currentTime);

    tleData.forEach((sat, i) => {
      const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
      const positionAndVelocity = satellite.propagate(satrec, date);
      const gmst = satellite.gstime(date);

      const positionEci = positionAndVelocity.position;
      if (!positionEci) return;

      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      const longitude = satellite.radiansToDegrees(positionGd.longitude);
      const latitude = satellite.radiansToDegrees(positionGd.latitude);
      const height = positionGd.height;

      const earthRadius = 5;
      const scaleFactor = 6371;
      const radius = earthRadius + height / scaleFactor;

      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + satellite.radiansToDegrees(gmst)) * (Math.PI / 180);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      meshRef.current.setMatrixAt(i, new THREE.Matrix4().setPosition(x, y, z));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, tleData.length]}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color="#ff0000" />
    </instancedMesh>
  );
}

// Астрономические расчёты
function getJulianDate(date) {
  return date / 86400000 + 2440587.5;
}

function getSunPosition(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T;
  const M = 357.52911 + 35999.05029 * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M * Math.PI / 180) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * M * Math.PI / 180);
  const lambda = (L0 + C) * Math.PI / 180;
  const epsilon = (23.439281 - 0.0130042 * T) * Math.PI / 180;

  return {
    longitude: lambda,
    latitude: Math.asin(Math.sin(lambda) * Math.sin(epsilon)),
  };
}

function getMoonPosition(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L = 218.3164591 + 481267.88134236 * T;
  const M = 134.9634114 + 477198.8676313 * T;
  const F = 93.2720993 + 483202.0175273 * T;
  const D = 297.8502042 + 445267.1115168 * T;

  const lambda = L + (6.28875 * Math.sin(M * Math.PI / 180)) +
                 (1.27402 * Math.sin((2 * D - M) * Math.PI / 180));
  const beta = 5.12819 * Math.sin(F * Math.PI / 180);

  return {
    longitude: lambda * Math.PI / 180,
    latitude: beta * Math.PI / 180,
  };
}

function App() {
  const [tleData, setTleData] = useState([]);
  const [timeScale, setTimeScale] = useState(1); // Множитель времени (1 = реальное время)

  useEffect(() => {
    fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle')
      .then((response) => response.text())
      .then((data) => {
        const lines = data.trim().split('\n');
        const satellites = [];
        for (let i = 0; i < lines.length; i += 3) {
          if (lines[i + 2]) {
            satellites.push({
              name: lines[i].trim(),
              line1: lines[i + 1].trim(),
              line2: lines[i + 2].trim(),
            });
          }
        }
        setTleData(satellites);
        console.log('Всего спутников:', satellites.length);
      })
      .catch((error) => console.error('Ошибка загрузки TLE:', error));
  }, []);

  const handleTimeScaleChange = (event) => {
    setTimeScale(parseFloat(event.target.value));
  };

  return (
    <div className="app">
      <header>
        <h1>Starlink Tracker</h1>
        <p>Спутников загружено: {tleData.length}</p>
        <div className="controls">
          <label htmlFor="timeScale">Ускорение времени: {timeScale}x</label>
          <input
            type="range"
            id="timeScale"
            min="1"
            max="1000"
            step="1"
            value={timeScale}
            onChange={handleTimeScaleChange}
          />
        </div>
      </header>
      <Canvas
        camera={{ position: [0, 0, 15], fov: 75 }}
        shadows
      >
        <ambientLight intensity={0.1} />
        <Earth timeScale={timeScale} />
        <Sun timeScale={timeScale} />
        <Moon timeScale={timeScale} />
        {tleData.length > 0 && <Satellites tleData={tleData} timeScale={timeScale} />}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        <OrbitControls enablePan={false} />
        <axesHelper args={[10]} />
      </Canvas>
    </div>
  );
}

export default App;