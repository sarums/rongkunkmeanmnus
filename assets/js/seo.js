// ═══════════════════════════════════════════════════
//  seo.js — SEO meta tags, JSON-LD updater
// ═══════════════════════════════════════════════════

window.updateMeta = function({title, desc, image, url, type='website'}){
  const sn = window.siteName||'RongKunKmeanMnus';
  const fullTitle = title ? `${title} | ${sn}` : `${sn} - វីដេអូកម្សាន្ត`;
  const fullDesc  = desc  || 'មើលវីដេអូកម្សាន្ត រឿងភាគ និងភាពយន្តល្អៗ។ Watch Khmer drama and entertainment videos online.';
  const fullUrl   = url   || location.href;
  const fullImg   = image || 'https://rongkunkmeanmnus.vercel.app/assets/img/og-default.jpg';

  document.title = fullTitle;

  const $id =(id,attr,val)=>{ const el=document.getElementById(id); if(el) el.setAttribute(attr,val); };
  const $prop=(prop,val)=>{ const el=document.querySelector(`meta[property="${prop}"]`); if(el) el.setAttribute('content',val); };

  // Primary
  $id('meta-desc','content', fullDesc);
  $id('canonical','href',    fullUrl);

  // Open Graph
  $prop('og:type',        type);
  $id('og-title','content', fullTitle);
  $id('og-desc','content',  fullDesc);
  $id('og-image','content', fullImg);
  $id('og-url','content',   fullUrl);
  $id('og-image-alt','content', title||sn);

  // Twitter
  $id('tw-title','content', fullTitle);
  $id('tw-desc','content',  fullDesc);
  $id('tw-image','content', fullImg);

  // JSON-LD
  const jsonld = document.getElementById('jsonld-main');
  if(!jsonld) return;
  if(type === 'video.other' && title){
    jsonld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": title,
      "description": fullDesc,
      "thumbnailUrl": fullImg,
      "url": fullUrl,
      "embedUrl": fullUrl,
      "uploadDate": new Date().toISOString(),
      "inLanguage": "km"
    });
  } else {
    jsonld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": sn,
      "alternateName": "រ៉ុងគ្នាមានអ្នស",
      "url": "https://rongkunkmeanmnus.vercel.app",
      "description": fullDesc,
      "inLanguage": ["km","en"],
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://rongkunkmeanmnus.vercel.app/search?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    });
  }
};
