'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { shortId } from './short-id';

/** Shows a shortened ID in mono with a copy button; the full ID is in the title attr. */
export default function CopyId({ id, label }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <span className="copy-id" title={id}>
    <span>{label ?? shortId(id)}</span>
    <button type="button" aria-label={copied ? 'Copied' : `Copy ${id}`} onClick={() => void navigator.clipboard?.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => undefined)}>
      {copied ? <Check aria-hidden="true"/> : <Copy aria-hidden="true"/>}
    </button>
  </span>;
}
