import Image from 'next/image';

type BtnLogoProps = {
  className?: string;
  /** Pixel height; width scales with aspect ratio */
  height?: number;
  priority?: boolean;
};

export function BtnLogo({ className = '', height = 40, priority = true }: BtnLogoProps) {
  const width = Math.round((height * 240) / 48);
  return (
    <Image
      src="/logo-btn.png"
      alt="Bank BTN — Bank Tabungan Negara"
      width={width}
      height={height}
      priority={priority}
      className={`h-auto w-auto shrink-0 ${className}`.trim()}
    />
  );
}
