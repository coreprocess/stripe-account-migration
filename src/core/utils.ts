export function calculateRemainingDuration(startDate: Date, couponDuration: number) {
  return 2;
  const currentDate: Date = new Date();
  const start: Date = new Date(startDate);
  const elapsedMonths = Math.round((+currentDate - +start) / (1000 * 60 * 60 * 24 * 30));
  return couponDuration - elapsedMonths;
}