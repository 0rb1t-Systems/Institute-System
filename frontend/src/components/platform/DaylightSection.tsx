import React from 'react'

/** Architectural cut of a training center — workshop → classroom → admin → credentials. */
export default function DaylightSection() {
  return (
    <div
      className="relative h-[220px] w-full overflow-hidden border border-[var(--landing-ink)] bg-[var(--landing-room)] sm:h-[280px] lg:h-[360px]"
      style={{ borderRadius: 'var(--landing-radius)' }}
      aria-label="Training center daylight section: workshop, classroom, admin desk, credentials"
    >
      <div className="absolute inset-y-0 left-0 w-3 bg-[var(--landing-poche)] sm:w-8 lg:w-12" />
      <div className="absolute inset-y-0 right-0 w-3 bg-[var(--landing-poche)] sm:w-8 lg:w-12" />
      <div className="absolute bottom-0 left-3 right-3 h-10 bg-[var(--landing-room-dim)] sm:left-8 sm:right-8 sm:h-12 lg:left-12 lg:right-12 lg:h-[60px]" />
      <div className="absolute left-3 right-3 top-5 h-0.5 bg-[var(--landing-ink)] sm:left-8 sm:right-8 lg:left-12 lg:right-12 lg:top-9" />

      <div className="landing-sunbeam absolute bottom-10 left-[12%] top-0 w-10 bg-gradient-to-b from-[var(--landing-sun)]/35 to-[var(--landing-sun)]/8 sm:w-16 lg:bottom-[60px] lg:w-[140px]" />
      <p className="absolute left-[14%] top-3 text-[9px] font-bold tracking-[0.12em] text-[var(--landing-sun)] sm:top-4 sm:text-[10px]">
        SUN PATH →
      </p>

      {[
        { label: 'WORKSHOP', left: '6%', props: true },
        { label: 'CLASSROOM', left: '30%' },
        { label: 'ADMIN DESK', left: '54%' },
        { label: 'CREDENTIALS', left: '78%' },
      ].map((room) => (
        <React.Fragment key={room.label}>
          <div
            className="absolute bottom-10 top-8 w-0.5 bg-[var(--landing-ink)] lg:bottom-[60px] lg:top-10"
            style={{ left: room.left }}
          />
          <p
            className="absolute top-10 text-[8px] font-semibold tracking-[0.12em] text-[var(--landing-shadow)] sm:top-12 sm:text-[10px] lg:top-14 lg:text-[11px]"
            style={{ left: `calc(${room.left} + 0.75rem)` }}
          >
            {room.label}
          </p>
        </React.Fragment>
      ))}

      {/* Workshop bench */}
      <div
        className="absolute bottom-12 h-8 w-14 bg-[var(--landing-poche)] sm:bottom-14 sm:h-10 sm:w-20 lg:bottom-16 lg:h-12 lg:w-[120px]"
        style={{ left: '8%', borderRadius: 1 }}
      />
      {/* Classroom board + windows */}
      <div
        className="absolute border border-[var(--landing-ink)] bg-[var(--landing-room-dim)]"
        style={{ left: '34%', top: '22%', width: '12%', height: '28%' }}
      />
      <div
        className="absolute border border-[var(--landing-ink)] bg-[var(--landing-sun-soft)]"
        style={{ left: '36%', top: '28%', width: '3%', height: '14%' }}
      />
      <div
        className="absolute border border-[var(--landing-ink)] bg-[var(--landing-sun-soft)]"
        style={{ left: '40%', top: '28%', width: '3%', height: '14%' }}
      />
      {/* Admin desk + person */}
      <div
        className="absolute bg-[var(--landing-shadow)]"
        style={{ left: '58%', bottom: '18%', width: '11%', height: '18%' }}
      />
      <div
        className="absolute rounded-full bg-[var(--landing-poche)]"
        style={{ left: '62%', bottom: '38%', width: 14, height: 14 }}
      />
      <div
        className="absolute bg-[var(--landing-poche)]"
        style={{ left: '62%', bottom: '22%', width: 14, height: '16%', borderRadius: 1 }}
      />
      {/* Credentials seal */}
      <div
        className="absolute bg-[var(--landing-sun)]"
        style={{ left: '84%', top: '38%', width: '5.5%', aspectRatio: '1', borderRadius: 1 }}
      />

      <div className="absolute bottom-0 left-3 flex h-8 items-center bg-[var(--landing-poche)] px-3 sm:left-8 sm:h-10 sm:px-4 lg:left-12">
        <p className="text-[9px] font-medium tracking-wider text-[var(--landing-on-poche)] sm:text-[11px]">
          SECTION · 08:12 · SUN ANGLE 34°
        </p>
      </div>
    </div>
  )
}
