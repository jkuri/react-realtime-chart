export const subSeconds = (date: Date, seconds: number): Date => {
  return new Date(date.getTime() - seconds * 1000);
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateRandomRealtimeData = (
  n = 10,
  step = 1,
  min = 0,
  max = 100,
  date = new Date(),
): { date: Date; value: number }[] => {
  return Array.from(Array(n).keys())
    .map((_, i) => ({
      date: subSeconds(date, i * step),
      value: randomInt(min, max),
    }))
    .reverse();
};
