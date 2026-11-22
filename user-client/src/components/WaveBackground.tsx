export function WaveBackground() {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="chinese-learner-wave" viewBox="0 0 1200 500" preserveAspectRatio="none">
          <path
            d="M0 500V330C150 260 260 380 420 330S700 190 860 260 1100 330 1200 250V500Z"
            style={{ fill: 'var(--m)', opacity: 0.16 }}
          />
          <path
            d="M0 500V400C180 330 320 450 520 390S820 300 1000 360 1150 380 1200 340V500Z"
            style={{ fill: 'var(--m)', opacity: 0.24 }}
          />
          <path
            d="M0 420C180 350 320 470 520 410S820 320 1000 380 1150 400 1200 360"
            fill="none"
            style={{ stroke: 'var(--m2)' }}
            strokeWidth="2"
            opacity="0.75"
          />
        </symbol>
      </svg>
      <svg
        className="wave"
        aria-hidden="true"
        viewBox="0 0 1200 500"
        preserveAspectRatio="none"
      >
        <use href="#chinese-learner-wave" />
      </svg>
      <svg
        className="wave top"
        aria-hidden="true"
        viewBox="0 0 1200 500"
        preserveAspectRatio="none"
      >
        <use href="#chinese-learner-wave" />
      </svg>
    </>
  );
}
