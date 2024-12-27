import React, { useEffect, useRef, useState } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { geoContains, geoBounds } from "d3-geo";

const GlobeComponent: React.FC = () => {
  const globeRef = useRef<GlobeMethods | undefined>();
  const [pointsData, setPointsData] = useState<{ lat: number; lng: number }[]>(
    []
  );
  const [globeMaterial, setGlobeMaterial] = useState<THREE.MeshBasicMaterial>();

  // Earth's approximate radius in kilometers
  const EARTH_RADIUS = 6371;
  // Desired distance between points, in kilometers
  const DISTANCE = 100;

  useEffect(() => {
    if (!globeRef.current) return;

    // Optionally recolor the globe
    const globeObj = globeRef.current
      .scene()
      .children.find(
        (obj) => (obj as THREE.Mesh).type === "Mesh"
      ) as THREE.Mesh;
    if (globeObj && globeObj.material) {
      const globeMat = globeObj.material as THREE.MeshBasicMaterial;
      globeMat.color = new THREE.Color("#afafaf");
      setGlobeMaterial(globeMat);
    }
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.6;
  }, []);

  const handleGlobeReady = () => {
    // 1) Generate a globally spaced grid based on geodesic distance
    const globalPoints: { lat: number; lng: number }[] = [];

    // Convert 100 km distance to lat steps in degrees
    const latStepDeg = (DISTANCE / EARTH_RADIUS) * (180 / Math.PI);

    for (let latDeg = -90; latDeg <= 90; latDeg += latStepDeg) {
      // Avoid extremely close to the poles
      if (Math.abs(latDeg) > 89.999) continue;
      const latRad = (latDeg * Math.PI) / 180;
      const cosLat = Math.cos(latRad);
      if (Math.abs(cosLat) < 1e-6) continue;

      // Convert spacing to a longitude step at this latitude
      const lonStepDeg = (DISTANCE / (EARTH_RADIUS * cosLat)) * (180 / Math.PI);

      for (let lngDeg = -180; lngDeg <= 180; lngDeg += lonStepDeg) {
        globalPoints.push({ lat: latDeg, lng: lngDeg });
      }
    }

    // 2) Fetch country polygons
    fetch(
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    )
      .then((res) => res.json())
      .then((geojson) => {
        const features = geojson.features;

        // 2a) Precompute bounding boxes for each polygon
        // We'll store them as [minLng, minLat, maxLng, maxLat]
        const polyData = features
          .map((f: any) => {
            if (!f.geometry) return null;
            const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(f);
            return {
              feature: f,
              bbox: [minLng, minLat, maxLng, maxLat],
            };
          })
          // remove any null
          .filter(Boolean);

        // 3) Filter globalPoints by whether they’re inside (any) polygon
        //    but only run geoContains if the point is within bounding box
        const validPoints: { lat: number; lng: number }[] = [];

        globalPoints.forEach((p) => {
          const { lat, lng } = p;

          // Find if any polygon bounding box contains this point
          const inSomePoly = polyData.some((pd) => {
            const [minLng, minLat, maxLng, maxLat] = pd!.bbox;
            if (
              lng >= minLng &&
              lng <= maxLng &&
              lat >= minLat &&
              lat <= maxLat
            ) {
              // bounding box pass; now do the expensive geoContains check
              return geoContains(pd!.feature, [lng, lat]);
            }
            return false;
          });

          if (inSomePoly) {
            validPoints.push(p);
          }
        });

        setPointsData(validPoints);
      });
  };

  return (
    <Globe
      ref={globeRef}
      globeMaterial={globeMaterial}
      backgroundColor="rgba(0,0,0,0)"
      showGlobe
      globeImageUrl={null}
      pointsData={pointsData}
      pointAltitude={0}
      pointRadius={0.3}
      pointColor={() => "#62686d"}
      onGlobeReady={handleGlobeReady}
    />
  );
};

export default GlobeComponent;
