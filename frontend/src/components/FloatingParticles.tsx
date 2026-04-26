import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  size: number;
  left: number;
  top: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

export default function FloatingParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = [
      'rgba(59, 130, 246, 0.4)', // Light Blue
      'rgba(16, 185, 129, 0.4)', // Light Emerald
      'rgba(139, 92, 246, 0.4)', // Light Purple
      'rgba(255, 255, 255, 0.4)', // White
    ];

    const newParticles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      size: Math.random() * (20 - 4) + 4,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: Math.random() * (25 - 10) + 10,
      delay: Math.random() * 5,
      opacity: Math.random() * (0.15 - 0.05) + 0.05,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full blur-[2px]"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            backgroundColor: p.color,
            opacity: p.opacity,
            animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}
      
      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
          }
          100% {
            transform: translateY(-40px) translateX(20px);
          }
        }
      `}</style>
    </div>
  );
}
