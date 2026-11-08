import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/ui/toast'
import { ApiError } from './api'
import { getLibraryItem, type LibraryCard } from './admin'
import { useAuth } from './auth'
import { saveNewCreation } from './creations'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { setPreviewModel } from './previewModel'

/**
 * Opening a library model: it becomes the student's own copy in My models (so they can change it like
 * anything they built) and opens in the workspace. Signed out, a model free to view opens to look at (cut it,
 * run it, move the sliders; not saved); any other asks them to sign in first.
 */
export function useOpenLibrary() {
  const navigate = useNavigate()
  const signedIn = useAuth((s) => s.status) === 'signed-in'
  const [opening, setOpening] = useState<string | null>(null)
  const open = async (item: LibraryCard) => {
    if (!signedIn && item.free) {
      setOpening(item.id)
      try {
        const full = await getLibraryItem(item.id)
        const spec = (sanitizeGeneratedSpec({ spec: full.spec }, full.prompt) as unknown as Record<string, unknown> | null) ?? full.spec
        setPreviewModel({ title: full.title, prompt: full.prompt, spec, explanation: full.explanation, backTo: '/library' })
        navigate('/create/preview')
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Couldn’t open that model. Please try again.', { tone: 'warn' })
        setOpening(null)
      }
      return
    }
    if (!signedIn) {
      toast('Sign in to open this model: you get your own copy to change, saved in My models. Models marked free open without an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
      return
    }
    setOpening(item.id)
    try {
      const full = await getLibraryItem(item.id)
      const spec = (sanitizeGeneratedSpec({ spec: full.spec }, full.prompt) as unknown as Record<string, unknown> | null) ?? full.spec
      const { id } = await saveNewCreation({ title: full.title, prompt: full.prompt, spec, thumbnail: full.thumbnail, history: full.explanation ? [{ prompt: full.prompt, response: full.explanation.slice(0, 2000) }] : [] })
      navigate(`/create/${id}`)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t open that model. Please try again.', { tone: 'warn' })
      setOpening(null)
    }
  }
  return { opening, open }
}
