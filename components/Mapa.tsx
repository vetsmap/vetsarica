'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const icono = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const icono24h = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const iconoUsuario = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

type Servicio = {
  id: string
  nombre: string
  precio_min: number | null
  precio_max: number | null
}

type Horario = {
  id: string
  dia_semana: number
  hora_apertura: string
  hora_cierre: string
  cerrado: boolean
}

type Vet = {
  id: string
  nombre: string
  direccion: string
  latitud: number
  longitud: number
  telefono: string
  abierto_24h: boolean
  servicios: Servicio[]
  horarios: Horario[]
}

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1)
}

const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function Mapa({ vets, vetSeleccionado }: { vets: Vet[], vetSeleccionado: Vet | null }) {
  const mapRef = useRef<L.Map | null>(null)
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mapRef.current) return

    const map = L.map('mapa').setView([-18.4746, -70.2979], 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current) return
          const { latitude, longitude } = pos.coords
          setUbicacion({ lat: latitude, lng: longitude })

          L.marker([latitude, longitude], { icon: iconoUsuario })
            .addTo(mapRef.current)
            .bindPopup('📍 Tú estás aquí')
            .openPopup()

          mapRef.current.setView([latitude, longitude], 14)
        },
        () => setError('No se pudo obtener tu ubicación')
      )
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Centrar mapa cuando se selecciona una clínica del panel
  useEffect(() => {
    if (!vetSeleccionado || !mapRef.current) return
    mapRef.current.setView([vetSeleccionado.latitud, vetSeleccionado.longitud], 16)
  }, [vetSeleccionado])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        const pos = layer.getLatLng()
        if (ubicacion && pos.lat === ubicacion.lat && pos.lng === ubicacion.lng) return
        layer.remove()
      }
    })

    vets.forEach(vet => {
      const serviciosHtml = vet.servicios?.map(s => {
        const precio = s.precio_min
          ? s.precio_min === s.precio_max
            ? `$${s.precio_min.toLocaleString()}`
            : `$${s.precio_min.toLocaleString()} - $${s.precio_max?.toLocaleString()}`
          : 'Precio a consultar'
        return `<li>${s.nombre}: <strong>${precio}</strong></li>`
      }).join('') ?? ''

      const horariosHtml = vet.horarios
        ?.sort((a, b) => a.dia_semana - b.dia_semana)
        .map(h => `<li>${dias[h.dia_semana]}: ${h.hora_apertura.slice(0,5)} - ${h.hora_cierre.slice(0,5)}</li>`)
        .join('') ?? ''

      const dist = ubicacion
        ? `📍 ${calcularDistancia(ubicacion.lat, ubicacion.lng, vet.latitud, vet.longitud)} km de ti<br/>`
        : ''

      L.marker([vet.latitud, vet.longitud], { icon: vet.abierto_24h ? icono24h : icono })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:200px;font-family:sans-serif">
            <strong style="font-size:14px">${vet.nombre}</strong><br/>
            ${vet.direccion}<br/>
            📞 ${vet.telefono}<br/>
            ${dist}
            ${vet.abierto_24h ? '<span style="color:#00c853;font-weight:700">🟢 Abierto 24h</span>' : '⚪ Horario normal'}<br/>
            <hr style="margin:6px 0;border-color:#eee"/>
            <strong>Servicios:</strong>
            <ul style="margin:4px 0;padding-left:16px">${serviciosHtml}</ul>
            <strong>Horarios:</strong>
            <ul style="margin:4px 0;padding-left:16px">${horariosHtml}</ul>
          </div>
        `, { maxWidth: 280 })
    })
  }, [vets, ubicacion])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {error && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: '#ff5252', color: '#fff', padding: '8px 16px',
          borderRadius: '8px', fontSize: '13px', zIndex: 1000
        }}>
          {error}
        </div>
      )}
      <div id="mapa" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}