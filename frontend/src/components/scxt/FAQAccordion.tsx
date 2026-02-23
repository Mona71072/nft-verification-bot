import { useState } from 'react';
import { Accordion, RotateIcon } from '@/components/motion/Accordion';
import { cn } from '@/lib/utils';

interface FAQItem {
  q: string;
  a: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

export function FAQAccordion({ items, className }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-lg font-semibold text-white mb-4">よくある質問</h3>
      {items.map((item, i) => (
        <div
          key={i}
          className="border border-white/10 rounded-lg overflow-hidden bg-white/5"
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left text-white font-medium hover:bg-white/5 transition-colors"
          >
            <span>{item.q}</span>
            <RotateIcon isOpen={openIndex === i}>▼</RotateIcon>
          </button>
          <Accordion isOpen={openIndex === i}>
            <div className="px-4 pb-3 pt-0 text-white/80 text-sm">{item.a}</div>
          </Accordion>
        </div>
      ))}
    </div>
  );
}
