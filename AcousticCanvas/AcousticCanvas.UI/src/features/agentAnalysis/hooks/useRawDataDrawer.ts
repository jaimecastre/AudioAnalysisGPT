import { useState } from 'react';

export function useRawDataDrawer() {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = () => setIsExpanded((prev) => !prev);

  return { isExpanded, toggle };
}
