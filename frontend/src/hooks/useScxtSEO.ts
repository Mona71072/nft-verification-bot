import { useEffect } from 'react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://syndicatextokyo.app';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  ogType?: 'website' | 'article';
}

/**
 * SPA 用 SEO: document.title と meta タグを動的更新
 */
export function useScxtSEO({ title, description, image, ogType = 'website' }: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes('|') ? title : `${title} | SyndicateXTokyo`;
    document.title = fullTitle;

    const metaTags: Array<{ name: string; content: string } | { property: string; content: string }> = [];
    if (description) {
      metaTags.push({ name: 'description', content: description });
      metaTags.push({ property: 'og:description', content: description });
      metaTags.push({ name: 'twitter:description', content: description });
    }
    metaTags.push({ property: 'og:title', content: fullTitle });
    metaTags.push({ name: 'twitter:title', content: fullTitle });
    metaTags.push({ property: 'og:type', content: ogType });
    metaTags.push({ property: 'og:url', content: BASE_URL + (typeof window !== 'undefined' ? window.location.pathname : '') });
    if (image) {
      const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;
      metaTags.push({ property: 'og:image', content: imageUrl });
      metaTags.push({ name: 'twitter:image', content: imageUrl });
      metaTags.push({ name: 'twitter:card', content: 'summary_large_image' });
    }

    const elements: HTMLElement[] = [];
    metaTags.forEach((tag) => {
      const isProperty = 'property' in tag;
      const attr = isProperty ? 'property' : 'name';
      const key = isProperty ? (tag as { property: string }).property : (tag as { name: string }).name;
      const content = tag.content;
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      elements.push(el);
    });

    return () => {
      // クリーンアップはしない（他のページで上書きされる想定）
    };
  }, [title, description, image, ogType]);
}
