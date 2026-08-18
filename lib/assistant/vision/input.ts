/**
 * Kininaru Assistant — Vision Input
 *
 * Handles image upload and screenshot capture for multimodal AI.
 * The model `openai/gpt-oss-120b` on Groq supports vision natively.
 *
 * Architecture:
 *   Image / Screenshot
 *        ↓
 *   VisionInput (this module)
 *        ↓
 *   Base64 data URL
 *        ↓
 *   AI Core (multimodal message)
 *
 * Supported formats: PNG, JPEG, WebP
 * Max size: 10 MB
 * Privacy: images are sent to the AI service for analysis, not stored locally
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type VisionInputState = 'idle' | 'selected' | 'processing' | 'error'

export interface VisionImage {
  /** Base64 data URL (data:image/...;base64,...) */
  dataUrl: string
  /** Original filename */
  name: string
  /** MIME type */
  mimeType: string
  /** Size in bytes */
  size: number
}

export interface VisionInputCallbacks {
  onImageSelected?: (image: VisionImage) => void
  onImageRemoved?: () => void
  onStateChange?: (state: VisionInputState) => void
  onError?: (error: string) => void
}

export interface VisionInput {
  /** Current state */
  state: VisionInputState
  /** Currently selected image (or null) */
  image: VisionImage | null
  /** Whether the browser supports the features */
  supported: boolean
  /** Select an image from file input */
  selectFromFile: () => void
  /** Capture screen content */
  captureScreen: () => Promise<void>
  /** Remove the selected image */
  removeImage: () => void
  /** Get the image as base64 for the API */
  getImageForApi: () => { type: 'image'; image: string } | null
  /** Update callbacks */
  setCallbacks: (callbacks: VisionInputCallbacks) => void
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_DIMENSION = 2048 // Max width/height in pixels

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Resizes an image if it exceeds max dimensions.
 * Returns the original data URL if no resize needed.
 */
async function resizeIfNeeded(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION) {
        resolve(dataUrl)
        return
      }

      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > height) {
        height = Math.round((height / width) * MAX_DIMENSION)
        width = MAX_DIMENSION
      } else {
        width = Math.round((width / height) * MAX_DIMENSION)
        height = MAX_DIMENSION
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Converts a File to a base64 data URL.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates a VisionInput instance.
 *
 * @param callbacks - Event callbacks
 * @returns VisionInput instance
 */
export function createVisionInput(
  callbacks?: VisionInputCallbacks
): VisionInput {
  const screenCaptureSupported = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getDisplayMedia' in navigator.mediaDevices

  let state: VisionInputState = 'idle'
  let currentImage: VisionImage | null = null
  let cbs = callbacks ?? {}
  let fileInput: HTMLInputElement | null = null

  const updateState = (newState: VisionInputState) => {
    state = newState
    cbs.onStateChange?.(newState)
  }

  const processFile = async (file: File) => {
    // Validate MIME type
    if (!isAllowedMimeType(file.type)) {
      updateState('error')
      cbs.onError?.(`Format non supporté. Utilisez PNG, JPEG ou WebP.`)
      return
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      updateState('error')
      cbs.onError?.(`Fichier trop volumineux (${formatFileSize(file.size)}). Maximum : ${formatFileSize(MAX_SIZE_BYTES)}.`)
      return
    }

    updateState('processing')

    try {
      let dataUrl = await fileToDataUrl(file)
      dataUrl = await resizeIfNeeded(dataUrl)

      currentImage = {
        dataUrl,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      }

      updateState('selected')
      cbs.onImageSelected?.(currentImage)
    } catch (err) {
      updateState('error')
      cbs.onError?.('Erreur lors du traitement de l\'image.')
    }
  }

  const instance: VisionInput = {
    get state() { return state },
    get image() { return currentImage },
    get supported() { return true }, // File upload is universally supported

    selectFromFile: () => {
      // Create or reuse file input
      if (!fileInput) {
        fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = ALLOWED_MIME_TYPES.join(',')
        fileInput.style.display = 'none'
        document.body.appendChild(fileInput)

        fileInput.addEventListener('change', () => {
          const file = fileInput?.files?.[0]
          if (file) processFile(file)
          if (fileInput) fileInput.value = ''
        })
      }

      fileInput.click()
    },

    captureScreen: async () => {
      if (!screenCaptureSupported) {
        updateState('error')
        cbs.onError?.('La capture d\'écran n\'est pas supportée par ce navigateur.')
        return
      }

      updateState('processing')

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' } as MediaTrackConstraints,
        })

        const track = stream.getVideoTracks()[0]
        if (!track) {
          updateState('error')
          cbs.onError?.('Aucun écran sélectionné.')
          return
        }

        // Capture a single frame
        const video = document.createElement('video')
        video.srcObject = stream
        await video.play()

        // Wait a frame for the video to render
        await new Promise(r => setTimeout(r, 100))

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          track.stop()
          stream.getTracks().forEach(t => t.stop())
          updateState('error')
          cbs.onError?.('Erreur lors de la capture.')
          return
        }

        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

        // Stop the stream
        track.stop()
        stream.getTracks().forEach(t => t.stop())

        currentImage = {
          dataUrl,
          name: 'capture-ecran.jpg',
          mimeType: 'image/jpeg',
          size: Math.round(dataUrl.length * 0.75), // Approximate base64 size
        }

        updateState('selected')
        cbs.onImageSelected?.(currentImage)
      } catch (err) {
        // User cancelled the screen share
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateState('idle')
          return
        }
        updateState('error')
        cbs.onError?.('Capture d\'écran annulée ou refusée.')
      }
    },

    removeImage: () => {
      currentImage = null
      updateState('idle')
      cbs.onImageRemoved?.()
    },

    getImageForApi: () => {
      if (!currentImage) return null
      return {
        type: 'image' as const,
        image: currentImage.dataUrl,
      }
    },

    setCallbacks: (newCbs) => {
      cbs = newCbs
    },
  }

  return instance
}
