import { permanentRedirect } from "next/navigation"

const CANONICAL_URL = "https://cuentos.ar/"

export default function TeCuentoUnaHistoriaRedirect() {
  permanentRedirect(CANONICAL_URL)
}
