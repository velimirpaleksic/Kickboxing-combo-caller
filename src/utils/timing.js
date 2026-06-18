export const speedRanges = {
  Sporo: [6000, 8000],
  Srednje: [4000, 6000],
  Brzo: [2500, 4000],
};

export const getComboDelay = (speed) => {
  const [min, max] = speedRanges[speed] || speedRanges.Srednje;
  return Math.round(min + Math.random() * (max - min));
};
