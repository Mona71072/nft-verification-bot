import { getResponsiveValue } from '../../hooks/useResponsive';

interface HomePageHeaderProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export function HomePageHeader({ deviceType }: HomePageHeaderProps) {
  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.02);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes floatParticle {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.8;
          }
        }
      `}</style>
      <header 
        role="banner"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #3730a3 50%, #4338ca 75%, #4f46e5 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 15s ease infinite',
          backdropFilter: 'blur(20px)',
          padding: getResponsiveValue('2rem 1.5rem', '2.5rem 2rem', '3rem 2.5rem', deviceType),
          marginTop: '-1rem',
          marginLeft: '-1rem',
          marginRight: '-1rem',
          marginBottom: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 80px rgba(79, 70, 229, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* グロー効果 */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.4) 0%, transparent 70%)',
          animation: 'glowPulse 4s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0
        }} />
        
        {/* アニメーション背景パターン */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 0 0',
          animation: 'shimmer 20s linear infinite',
          pointerEvents: 'none',
          zIndex: 0
        }} />
        
        {/* フローティングパーティクル */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: getResponsiveValue('3px', '4px', '5px', deviceType),
              height: getResponsiveValue('3px', '4px', '5px', deviceType),
              background: `rgba(255, 255, 255, ${0.3 + i * 0.1})`,
              borderRadius: '50%',
              left: `${20 + i * 15}%`,
              top: `${30 + i * 10}%`,
              animation: `floatParticle ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 1}s`,
              boxShadow: `0 0 ${getResponsiveValue('6px', '8px', '10px', deviceType)} rgba(255, 255, 255, 0.5)`,
              pointerEvents: 'none',
              zIndex: 0
            }}
          />
        ))}
        
        {/* シャイン効果 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          animation: 'shimmer 3s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1
        }} />
      
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: getResponsiveValue('1.5rem', '1.875rem', '2.25rem', deviceType),
            fontWeight: '800',
            color: 'white',
            margin: `0 0 ${getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)} 0`,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 25%, #c7d2fe 50%, #a5b4fc 75%, #8b5cf6 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 40px rgba(79, 70, 229, 0.5), 0 0 80px rgba(59, 130, 246, 0.3)',
            filter: 'drop-shadow(0 4px 8px rgba(79, 70, 229, 0.4))',
            animation: 'gradientShift 8s ease infinite'
          }}>
            SyndicateXTokyo Portal
          </h1>
          <p style={{
            color: '#c7d2fe',
            fontSize: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
            fontWeight: '500',
            margin: 0,
            letterSpacing: '0.025em',
            textShadow: '0 2px 8px rgba(199, 210, 254, 0.4), 0 0 20px rgba(79, 70, 229, 0.2)'
          }}>
            Discover, collect, and manage your NFT collection
          </p>
        </div>
      </header>
    </>
  );
}
