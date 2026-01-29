/**
 * Health Indicator Component
 *
 * Pulsing dot that shows client health status.
 */

import type { HealthStatus } from './types';

interface HealthIndicatorProps {
  status: HealthStatus;
  size?: number;
}

export function HealthIndicator({ status, size = 8 }: HealthIndicatorProps) {
  const getClassName = () => {
    const base = 'health-indicator';
    switch (status) {
      case 'healthy':
        return `${base} health-healthy`;
      case 'idle':
        return `${base} health-idle`;
      case 'warning':
        return `${base} health-warning`;
      default:
        return base;
    }
  };

  return (
    <span
      className={getClassName()}
      style={{ width: size, height: size }}
      title={status === 'healthy' ? 'Active' : status === 'idle' ? 'Idle (2+ min)' : 'High error rate'}
    />
  );
}
