"use client";

interface GradualBlurProps {
  position?: "top" | "bottom" | "left" | "right";
  strength?: number;
  divCount?: number;
  exponential?: boolean;
  className?: string;
}

export default function GradualBlur({
  position = "bottom",
  strength = 15,
  divCount = 8,
  exponential = true,
  className = "",
}: GradualBlurProps) {
  // Generate the layers
  const layers = Array.from({ length: divCount });

  // Get gradient direction based on position
  const getGradientDirection = () => {
    switch (position) {
      case "top":
        return "to top";
      case "bottom":
        return "to bottom";
      case "left":
        return "to left";
      case "right":
        return "to right";
      default:
        return "to bottom";
    }
  };

  return (
    <div className={`relative ${className}`}>
      {layers.map((_, i) => {
        // Calculate blur for this layer
        // If exponential, use a power function, else linear
        const progress = (i + 1) / divCount;
        const blurAmount = exponential
          ? Math.pow(progress, 2) * strength
          : progress * strength;

        // Calculate mask coordinates: we want a gradient that fades out
        // The most blurred layer (last layer) has a mask that covers the outer edge
        const startPercent = (i / divCount) * 100;
        const endPercent = 100;

        const maskImage = `linear-gradient(${getGradientDirection()}, transparent ${startPercent}%, black ${endPercent}%)`;

        return (
          <div
            key={i}
            className="absolute inset-0 pointer-events-none"
            style={{
              backdropFilter: `blur(${blurAmount}px)`,
              WebkitBackdropFilter: `blur(${blurAmount}px)`,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        );
      })}
    </div>
  );
}
