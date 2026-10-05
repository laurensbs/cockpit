import 'server-only'
import { instagram } from './instagram'
import { mollie } from './mollie'
import { plausible } from './plausible'
import { stripe } from './stripe'
import type { ConnectorKind } from './types'

/** Every source the cockpit can read, in the order the form shows them. */
export const CONNECTOR_KINDS: ConnectorKind[] = [plausible, instagram, stripe, mollie]

export const connectorKind = (kind: string): ConnectorKind | null => CONNECTOR_KINDS.find((k) => k.kind === kind) ?? null

/** Where a connector's key is kept, in the local settings. */
export const connectorSecretKey = (id: string) => `connector:${id}`
