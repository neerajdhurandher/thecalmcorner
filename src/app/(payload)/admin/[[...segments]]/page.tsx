import config from '@payload-config'
import { generatePageMetadata, RootPage } from '@payloadcms/next/views'
import type { Metadata } from 'next'
import { importMap } from '../importMap.js'

type Props = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({
  params,
  searchParams,
}: Props): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

export default function AdminPage({ params, searchParams }: Props) {
  return RootPage({ config, params, searchParams, importMap })
}
