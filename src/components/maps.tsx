"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores';

const pinIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;border-radius:999px;background:#c24e2a;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .35)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function TileGuard({ onFail }: { onFail: () => void }) {
  return (
    <TileLayer
      attribution={ATTRIBUTION}
      url={TILES}
      eventHandlers={{ tileerror: () => onFail() }}
    />
  );
}

function Fit({ points, token }: { points: [number, number][]; token: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding: [28, 28], maxZoom: 14 });
  }, [map, token, points]);
  return null;
}

function Frame({
  testId,
  children,
  failed,
  note,
}: {
  testId: string;
  children: React.ReactNode;
  failed: boolean;
  note?: string;
}) {
  return (
    <div data-testid={testId} className="overflow-hidden rounded-3xl border border-line bg-sand">
      <div className="h-56">{children}</div>
      <p className="px-3 py-2 text-xs leading-4 text-muted">
        Mapa © OpenStreetMap. {note}
        {failed ? " No se cargaron las calles. La dirección escrita sigue siendo válida." : ""}
      </p>
    </div>
  );
}

export function PinMap({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const point = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);
  return (
    <Frame testId="location-map" failed={failed} note="Mueve el pin si el punto no cae en tu casa.">
      <MapContainer center={point} zoom={16} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileGuard onFail={() => setFailed(true)} />
        <Marker
          position={point}
          draggable
          icon={pinIcon}
          eventHandlers={{
            dragend: (event) => {
              const next = event.target.getLatLng();
              onMove(next.lat, next.lng);
            },
          }}
        />
      </MapContainer>
    </Frame>
  );
}

export function ZoneMap({
  lat,
  lng,
  exact,
  testId,
}: {
  lat: number;
  lng: number;
  exact: { lat: number; lng: number } | null;
  testId: string;
}) {
  const [failed, setFailed] = useState(false);
  const center = useMemo<[number, number]>(() => (exact ? [exact.lat, exact.lng] : [lat, lng]), [exact, lat, lng]);
  return (
    <Frame
      testId={testId}
      failed={failed}
      note={exact ? "Punto exacto, solo porque el trabajo ya está confirmado." : "Zona aproximada. La calle no se muestra todavía."}
    >
      <MapContainer center={center} zoom={exact ? 16 : 14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileGuard onFail={() => setFailed(true)} />
        {exact ? (
          <Marker position={[exact.lat, exact.lng]} icon={pinIcon}>
            <Popup>Ubicación confirmada del servicio.</Popup>
          </Marker>
        ) : (
          <Circle center={[lat, lng]} radius={900} pathOptions={{ color: "#c24e2a", weight: 2, fillColor: "#c24e2a", fillOpacity: 0.18 }} />
        )}
      </MapContainer>
    </Frame>
  );
}

export type MapProvider = {
  id: string;
  name: string;
  trade: string;
  zoneLat: number;
  zoneLng: number;
  isExample: boolean;
};

export function NearbyMap({
  testId,
  client,
  providers,
}: {
  testId: string;
  client: { lat: number; lng: number } | null;
  providers: MapProvider[];
}) {
  const [failed, setFailed] = useState(false);
  const points = useMemo<[number, number][]>(() => {
    const list: [number, number][] = providers.map((provider) => [provider.zoneLat, provider.zoneLng]);
    if (client) list.unshift([client.lat, client.lng]);
    return list.length > 0 ? list : [[19.4326, -99.1332]];
  }, [client, providers]);
  const token = points.map((point) => point.join(",")).join("|");
  return (
    <Frame testId={testId} failed={failed} note="Las personas se ven en su zona, no en una casa exacta. Tu casa también se muestra como un círculo.">
      <MapContainer center={points[0]} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileGuard onFail={() => setFailed(true)} />
        <Fit points={points} token={token} />
        {client ? (
          <Circle center={[client.lat, client.lng]} radius={700} pathOptions={{ color: "#1e6a56", weight: 2, fillColor: "#1e6a56", fillOpacity: 0.15 }}>
            <Popup>Tu zona, aproximada.</Popup>
          </Circle>
        ) : null}
        {providers.map((provider) => (
          <CircleMarker key={provider.id} center={[provider.zoneLat, provider.zoneLng]} radius={9} pathOptions={{ color: "#c24e2a", fillColor: "#c24e2a", fillOpacity: 0.9 }}>
            <Popup>
              <strong>{provider.name}</strong>
              <br />
              {provider.trade}
              {provider.isExample ? <><br />Ejemplo ficticio</> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </Frame>
  );
}
