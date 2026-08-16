import React from 'react';

/** Lightweight page wrapper — no framer-motion (keeps menu navigation snappy). */
const AnimatedPage = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);

export default AnimatedPage;
