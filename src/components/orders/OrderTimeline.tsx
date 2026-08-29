import React from 'react';
import { OrderStatusTimelineEntry } from '../../types/order';
import { Check, Clock, Radio } from 'lucide-react';

interface OrderTimelineProps {
  timeline: OrderStatusTimelineEntry[];
  currentStatus: string;
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ timeline, currentStatus }) => {
  return (
    <div className="order-timeline-list">
      {timeline.map((entry, index) => {
        const isCurrent = entry.status === currentStatus;
        const isCompleted = entry.completed;

        return (
          <div
            key={index}
            className={`timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
          >
            <div className="timeline-dot">
              {isCompleted && !isCurrent && (
                <Check size={10} color="#050a14" style={{ display: 'block', margin: '1px auto' }} />
              )}
              {isCurrent && (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', margin: '3px auto' }} />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div className="timeline-title" style={{ color: isCurrent ? 'var(--accent-cyan)' : isCompleted ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {entry.status}
              </div>
              <div className="timeline-time">
                {entry.timestamp}
              </div>
            </div>

            <div className="timeline-desc">
              {entry.description}
            </div>
          </div>
        );
      })}
    </div>
  );
};
