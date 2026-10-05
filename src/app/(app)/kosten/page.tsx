import { redirect } from 'next/navigation'

/** Kosten became part of Geld. */
export default function CostsPage() {
  redirect('/geld')
}
