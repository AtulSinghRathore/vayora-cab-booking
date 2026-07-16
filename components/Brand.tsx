import Link from "next/link";

type BrandProps = {
  href?: string;
  className?: string;
  name?: string;
  tagline?: boolean;
};

export default function Brand({ href = "/", className = "", name = "Vayora", tagline = true }: BrandProps) {
  return (
    <Link className={`brand ${className}`.trim()} href={href} aria-label={`${name} home`}>
      <span className="brand-mark" aria-hidden="true">V</span>
      <span className="brand-copy">
        <span className="brand-name">{name}</span>
        {tagline && <small>Every journey, cared for like family.</small>}
      </span>
    </Link>
  );
}
