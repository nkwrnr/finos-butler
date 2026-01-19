'use client';

interface Alert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

interface AlertsBannerProps {
  alerts: Alert[];
}

export default function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (!alerts || alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(a => a.level === 'critical');
  const warningAlerts = alerts.filter(a => a.level === 'warning');
  const infoAlerts = alerts.filter(a => a.level === 'info');

  return (
    <div className="space-y-2 mb-6">
      {criticalAlerts.map((alert, idx) => (
        <div
          key={`critical-${idx}`}
          className="p-4 bg-negative/10 border border-negative/30 rounded-lg flex items-start gap-3"
        >
          <span className="text-negative text-lg">!</span>
          <div>
            <span className="text-negative font-semibold text-sm uppercase tracking-wide">Critical</span>
            <p className="text-primary mt-1">{alert.message}</p>
          </div>
        </div>
      ))}

      {warningAlerts.map((alert, idx) => (
        <div
          key={`warning-${idx}`}
          className="p-4 bg-zcash/10 border border-zcash/30 rounded-lg flex items-start gap-3"
        >
          <span className="text-zcash text-lg">!</span>
          <div>
            <span className="text-zcash font-semibold text-sm uppercase tracking-wide">Warning</span>
            <p className="text-primary mt-1">{alert.message}</p>
          </div>
        </div>
      ))}

      {infoAlerts.map((alert, idx) => (
        <div
          key={`info-${idx}`}
          className="p-4 bg-surface border border-border rounded-lg flex items-start gap-3"
        >
          <span className="text-secondary text-lg">i</span>
          <div>
            <span className="text-secondary font-semibold text-sm uppercase tracking-wide">Info</span>
            <p className="text-primary mt-1">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
