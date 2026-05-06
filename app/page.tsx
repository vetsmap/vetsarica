'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const Mapa = dynamic(() => import('@/components/Mapa'), { ssr: false })

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
  foto_url: string | null
  servicios: Servicio[]
  horarios: Horario[]
}

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
}

function estaAbiertoAhora(vet: Vet): boolean {
  if (vet.abierto_24h) return true
  const ahora = new Date()
  const dia = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes()
  const horario = vet.horarios.find(h => h.dia_semana === dia)
  if (!horario || horario.cerrado) return false
  const [hA, mA] = horario.hora_apertura.split(':').map(Number)
  const [hC, mC] = horario.hora_cierre.split(':').map(Number)
  return horaActual >= hA * 60 + mA && horaActual <= hC * 60 + mC
}

function getIniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Home() {
  const [vets, setVets] = useState<Vet[]>([])
  const [solo24h, setSolo24h] = useState(false)
  const [vetSeleccionado, setVetSeleccionado] = useState<Vet | null>(null)
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [vistaMovil, setVistaMovil] = useState<'lista' | 'mapa'>('lista')
  const [esCelular, setEsCelular] = useState(false)

  useEffect(() => {
    supabase
      .from('veterinarios')
      .select('*, servicios(*), horarios(*)')
      .then(({ data }) => {
        if (data) setVets(data)
      })

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    }

    const checkCelular = () => setEsCelular(window.innerWidth < 768)
    checkCelular()
    window.addEventListener('resize', checkCelular)
    return () => window.removeEventListener('resize', checkCelular)
  }, [])

  const vetsFiltrados = solo24h ? vets.filter(v => v.abierto_24h) : vets

  const vetsOrdenados = ubicacion
    ? [...vetsFiltrados].sort((a, b) =>
      parseFloat(calcularDistancia(ubicacion.lat, ubicacion.lng, a.latitud, a.longitud)) -
      parseFloat(calcularDistancia(ubicacion.lat, ubicacion.lng, b.latitud, b.longitud))
    )
    : vetsFiltrados

  const panelLista = (
    <div style={{
      background: 'var(--fondo2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flex: esCelular ? 1 : 'none',
      width: esCelular ? '100%' : '310px',
      height: esCelular ? '100%' : 'auto',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo3)' }}>
        <p style={{ fontSize: '11px', color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {vetsOrdenados.length} veterinaria{vetsOrdenados.length !== 1 ? 's' : ''} encontrada{vetsOrdenados.length !== 1 ? 's' : ''}
          {ubicacion ? ' · ordenadas por distancia' : ''}
        </p>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {vetsOrdenados.map(vet => {
          const abierto = estaAbiertoAhora(vet)
          const distancia = ubicacion
            ? calcularDistancia(ubicacion.lat, ubicacion.lng, vet.latitud, vet.longitud)
            : null
          const seleccionado = vetSeleccionado?.id === vet.id

          return (
            <div
              key={vet.id}
              onClick={() => {
                setVetSeleccionado(seleccionado ? null : vet)
                if (esCelular) setVistaMovil('mapa')
              }}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--borde)',
                cursor: 'pointer',
                background: seleccionado ? '#edf7ee' : 'transparent',
                borderLeft: seleccionado ? '3px solid #4F772D' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: vet.foto_url ? '#ffffff' : (abierto ? '#4F772D' : '#9fb89a'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '1px solid var(--borde)',
                }}>
                  {vet.foto_url ? (
                    <img src={vet.foto_url} alt={vet.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
                      {getIniciales(vet.nombre)}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a2e23', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {vet.nombre}
                    </p>
                    {vet.abierto_24h && (
                      <span style={{ fontSize: '9px', background: '#4F772D', color: '#ffffff', padding: '2px 5px', borderRadius: '4px', fontWeight: 700, marginLeft: '6px', whiteSpace: 'nowrap' }}>
                        24H
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--texto2)', marginBottom: '6px', lineHeight: 1.3 }}>
                    {vet.direccion}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: abierto ? '#2d7a3a' : '#b04040', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: abierto ? '#2d7a3a' : '#b04040', display: 'inline-block' }} />
                      {abierto ? 'Abierto ahora' : 'Cerrado ahora'}
                    </span>
                    {distancia && (
                      <span style={{ fontSize: '12px', color: '#4F772D', fontWeight: 600 }}>📍 {distancia} km</span>
                    )}
                  </div>
                </div>
              </div>

              {seleccionado && !esCelular && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--borde)' }}>
                  <a
                    href={`tel:${vet.telefono}`}
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ffffff', background: '#4F772D', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, marginBottom: '14px' }}
                  >
                    📞 Llamar: {vet.telefono}
                  </a>

                  {vet.servicios?.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '10px', color: '#33511c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: 700 }}>Servicios</p>
                      {vet.servicios.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#1a2e23' }}>{s.nombre}</span>
                          <span style={{ color: '#33511c', fontWeight: 700 }}>
                            {s.precio_min ? s.precio_min === s.precio_max ? `$${s.precio_min.toLocaleString()}` : `$${s.precio_min.toLocaleString()} - $${s.precio_max?.toLocaleString()}` : 'A consultar'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {vet.horarios?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '10px', color: '#33511c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: 700 }}>Horarios</p>
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia, i) => {
                        const h = vet.horarios.find(horario => horario.dia_semana === i)
                        if (!h) return null
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                            <span style={{ color: '#33511c' }}>{dia}</span>
                            <span style={{ color: '#1a2e23', fontWeight: 500 }}>{h.hora_apertura.slice(0, 5)} - {h.hora_cierre.slice(0, 5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const panelMapa = (
    <div style={{ flex: 1, position: 'relative', height: esCelular ? '100%' : 'auto' }}>
      {esCelular && vetSeleccionado && (
        <div style={{
          position: 'absolute', top: '10px', left: '10px', right: '10px',
          background: '#ffffff', borderRadius: '12px', padding: '12px 16px',
          zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid var(--borde)',
        }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a2e23', marginBottom: '6px' }}>{vetSeleccionado.nombre}</p>
          <a
            href={`tel:${vetSeleccionado.telefono}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ffffff', background: '#4F772D', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, marginBottom: '8px' }}
          >
            📞 Llamar
          </a>
          {vetSeleccionado.servicios?.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', color: '#33511c', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Servicios</p>
              {vetSeleccionado.servicios.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: '#1a2e23' }}>{s.nombre}</span>
                  <span style={{ color: '#33511c', fontWeight: 700 }}>
                    {s.precio_min ? `$${s.precio_min.toLocaleString()}` : 'A consultar'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <Mapa vets={vetsFiltrados} vetSeleccionado={vetSeleccionado} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--fondo)' }}>

      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: '56px', background: '#C7F9CC',
        borderBottom: '1px solid #a0e8a8', flexShrink: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🐾</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: '16px', color: '#33511c' }}>VetArica</span>
          <span style={{ fontSize: '11px', background: '#4F772D', color: '#ffffff', padding: '2px 8px', borderRadius: '99px', fontWeight: 700 }}>LIVE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {esCelular && (
            <button
              onClick={() => setVistaMovil(vistaMovil === 'lista' ? 'mapa' : 'lista')}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid #4F772D',
                background: 'transparent', color: '#33511c', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {vistaMovil === 'lista' ? '🗺️ Mapa' : '📋 Lista'}
            </button>
          )}
          <button
            onClick={() => setSolo24h(!solo24h)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
              borderRadius: '8px', border: solo24h ? '1px solid #33511c' : '1px solid #4F772D',
              background: solo24h ? 'rgba(51,81,28,0.1)' : 'transparent',
              color: '#33511c', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4F772D', display: 'inline-block' }} />
            Solo 24h
          </button>
        </div>
      </nav>

      {esCelular ? (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {vistaMovil === 'lista' ? panelLista : panelMapa}
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '310px', flexShrink: 0, borderRight: '1px solid var(--borde)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {panelLista}
          </div>
          {panelMapa}
        </div>
      )}
    </div>
  )
}
