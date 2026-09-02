import './BrandMark.css';

export default function BrandMark({ className = '', title = 'VolleyCoach Hub' }) {
  return (
    <svg
      className={`volleycoach-brand-mark ${className}`.trim()}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
    >
      <path
        d="M16 29.5h20.5L52 62.5 67.5 39H89L60.5 84H44.5L16 29.5Z"
        fill="#111111"
      />
      <g transform="translate(72 23)">
        <circle r="12.5" fill="#FFC107" />
        <path d="M-9.5-4.5c5.8-1.9 11.5-.8 16.2 2.8" fill="none" stroke="#FFF5C7" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M-8 7.4c2.9-5.2 7.6-8.4 13.6-9.5" fill="none" stroke="#FFF5C7" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M1.4-11.4c1.5 5.8.7 11.4-2.5 16.4" fill="none" stroke="#FFF5C7" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.6 5.6c-5.5.4-10.4-1.4-14.5-5.1" fill="none" stroke="#FFF5C7" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
