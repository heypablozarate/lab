import { permanentRedirect } from "next/navigation"

const CANONICAL_ORIGIN = "https://cuentos.ar"

type StoryRedirectProps = {
  params: Promise<{ storySlug: string }>
}

export default async function TeCuentoStoryRedirect({ params }: StoryRedirectProps) {
  const { storySlug } = await params
  const destination = new URL(CANONICAL_ORIGIN)
  destination.pathname = `/relatos/${storySlug}`

  permanentRedirect(destination.toString())
}
