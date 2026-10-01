import { IconType } from 'react-icons'
import {
  SiGithub,
  SiSpotify,
  SiNotion,
  SiGooglechrome,
  SiFigma,
  SiGmail,
  SiGoogledrive,
  SiYoutube,
  SiX,
  SiInstagram,
  SiWhatsapp,
  SiTrello,
  SiVercel,
  SiNetlify,
} from 'react-icons/si'
import { FiLink, FiGlobe, FiCode, FiSlack, FiLinkedin, FiCpu, FiImage } from 'react-icons/fi'

const BRAND_MATCHERS: { test: RegExp; icon: IconType; color: string }[] = [
  { test: /vs ?code|visual ?studio/i, icon: FiCode, color: '#007ACC' },
  { test: /github/i, icon: SiGithub, color: '#ffffff' },
  { test: /spotify/i, icon: SiSpotify, color: '#1DB954' },
  { test: /notion/i, icon: SiNotion, color: '#ffffff' },
  { test: /chrome/i, icon: SiGooglechrome, color: '#4285F4' },
  { test: /figma/i, icon: SiFigma, color: '#F24E1E' },
  { test: /slack/i, icon: FiSlack, color: '#4A154B' },
  { test: /linkedin/i, icon: FiLinkedin, color: '#0A66C2' },
  { test: /gmail|email/i, icon: SiGmail, color: '#EA4335' },
  { test: /drive/i, icon: SiGoogledrive, color: '#34A853' },
  { test: /youtube/i, icon: SiYoutube, color: '#FF0000' },
  { test: /twitter|^x$/i, icon: SiX, color: '#ffffff' },
  { test: /instagram/i, icon: SiInstagram, color: '#E4405F' },
  { test: /whatsapp/i, icon: SiWhatsapp, color: '#25D366' },
  { test: /trello/i, icon: SiTrello, color: '#0052CC' },
  { test: /vercel/i, icon: SiVercel, color: '#ffffff' },
  { test: /netlify/i, icon: SiNetlify, color: '#00C7B7' },
  { test: /openai|chatgpt|gemini|claude/i, icon: FiCpu, color: '#ffffff' },
  { test: /canva/i, icon: FiImage, color: '#00C4CC' },
]

export function brandIconFor(name: string): { icon: IconType; color: string } {
  for (const m of BRAND_MATCHERS) {
    if (m.test.test(name)) return { icon: m.icon, color: m.color }
  }
  return { icon: name.trim() ? FiLink : FiGlobe, color: 'var(--mint)' }
}