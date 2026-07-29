'use client'

import { useActionState, useState } from 'react'
import { iniciarSesion, registrarse, type EstadoAuth } from './actions'
import { Aviso, Boton, Campo, Input } from '@/components/ui'

const inicial: EstadoAuth = {}

export default function FormularioLogin({
  redirigir,
  errorInicial,
}: {
  redirigir: string
  errorInicial?: string
}) {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [estadoEntrar, accionEntrar, pendienteEntrar] = useActionState(iniciarSesion, inicial)
  const [estadoCrear, accionCrear, pendienteCrear] = useActionState(registrarse, inicial)

  const estado = modo === 'entrar' ? estadoEntrar : estadoCrear
  const pendiente = modo === 'entrar' ? pendienteEntrar : pendienteCrear

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">MOORA</h1>
          <p className="text-sm text-gray-500">Inventario, ventas y finanzas</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setModo('entrar')}
              className={`flex-1 rounded-md py-2 font-medium ${
                modo === 'entrar' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setModo('crear')}
              className={`flex-1 rounded-md py-2 font-medium ${
                modo === 'crear' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form action={modo === 'entrar' ? accionEntrar : accionCrear} className="space-y-4">
            <input type="hidden" name="redirigir" value={redirigir} />

            {modo === 'crear' && (
              <Campo etiqueta="Nombre completo">
                <Input name="nombre" type="text" autoComplete="name" placeholder="Tu nombre" />
              </Campo>
            )}

            <Campo etiqueta="Correo">
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
              />
            </Campo>

            <Campo
              etiqueta="Contraseña"
              ayuda={modo === 'crear' ? 'Mínimo 8 caracteres.' : undefined}
            >
              <Input
                name="password"
                type="password"
                required
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
            </Campo>

            {errorInicial === 'inactivo' && (
              <Aviso>Tu cuenta está desactivada. Pide al administrador que la habilite.</Aviso>
            )}
            {estado.error && <Aviso>{estado.error}</Aviso>}
            {estado.mensaje && <Aviso tipo="ok">{estado.mensaje}</Aviso>}

            <Boton type="submit" disabled={pendiente} className="w-full">
              {pendiente ? 'Un momento…' : modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}
            </Boton>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          La primera cuenta que se registre queda como administrador.
        </p>
      </div>
    </main>
  )
}
