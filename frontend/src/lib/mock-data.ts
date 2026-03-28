export interface Trip {
  id: string;
  invoiceNumber: string;
  bookNumber: string;
  chassisNumber: string;
  vehicleNumber: string;
  date: string;
  loadingDate: string;
  unloadingDate: string;
  loadingPoint: string;
  unloadingPoint: string;
  tripType: "OWN" | "MARKET";
  partyType: "TPT" | "LOGISTICS" | "OTHER";
  partyName: string;
  weight: number;
  rate: number;
  income: number;
  diesel: number;
  toll: number;
  driverBhatta: number;
  otherExpenses: number;
  totalExpenses: number;
  profit: number;
}

export interface Vehicle {
  vehicleNumber: string;
  totalTrips: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
}

const vehicles = [
  "JH05AC0028", "JH05AC0045", "JH05AC0112", "JH05AC0067", "JH05AC0091",
  "JH05AC0034", "JH05AC0078", "JH05AC0055",
];

const routes = [
  ["Ranchi", "Kolkata"], ["Jamshedpur", "Mumbai"], ["Dhanbad", "Delhi"],
  ["Bokaro", "Chennai"], ["Hazaribagh", "Pune"], ["Ranchi", "Hyderabad"],
  ["Jamshedpur", "Bangalore"], ["Dhanbad", "Lucknow"],
];

const parties = [
  { name: "Tata Steel Transport", type: "TPT" as const },
  { name: "Blue Dart Logistics", type: "LOGISTICS" as const },
  { name: "SafeExpress", type: "LOGISTICS" as const },
  { name: "Gati Transport", type: "TPT" as const },
  { name: "Rivigo Freight", type: "OTHER" as const },
  { name: "Delhivery Cargo", type: "LOGISTICS" as const },
];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateTrips(count = 80): Trip[] {
  const trips: Trip[] = [];
  for (let i = 0; i < count; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const route = routes[randomBetween(0, routes.length - 1)];
    const party = parties[randomBetween(0, parties.length - 1)];
    const income = randomBetween(25000, 85000);
    const diesel = randomBetween(8000, 22000);
    const toll = randomBetween(1500, 5000);
    const driverBhatta = randomBetween(1000, 3000);
    const otherExpenses = randomBetween(500, 3000);
    const totalExpenses = diesel + toll + driverBhatta + otherExpenses;
    const month = randomBetween(1, 12);
    const day = randomBetween(1, 28);

    trips.push({
      id: `trip-${i + 1}`,
      invoiceNumber: `INV-2024-${String(i + 1).padStart(4, "0")}`,
      bookNumber: `BK-${String(randomBetween(100, 999))}`,
      chassisNumber: `CH${String(randomBetween(10000, 99999))}`,
      vehicleNumber: vehicle,
      date: `2024-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      loadingDate: `2024-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      unloadingDate: `2024-${String(month).padStart(2, "0")}-${String(Math.min(day + randomBetween(1, 3), 28)).padStart(2, "0")}`,
      loadingPoint: route[0],
      unloadingPoint: route[1],
      tripType: Math.random() > 0.4 ? "OWN" : "MARKET",
      partyType: party.type,
      partyName: party.name,
      weight: randomBetween(8, 25),
      rate: randomBetween(1200, 3500),
      income,
      diesel,
      toll,
      driverBhatta,
      otherExpenses,
      totalExpenses,
      profit: income - totalExpenses,
    });
  }
  return trips;
}

export function getVehicleSummaries(trips: Trip[]): Vehicle[] {
  const map = new Map<string, Vehicle>();
  trips.forEach((t) => {
    const existing = map.get(t.vehicleNumber);
    if (existing) {
      existing.totalTrips++;
      existing.totalIncome += t.income;
      existing.totalExpenses += t.totalExpenses;
      existing.profit += t.profit;
    } else {
      map.set(t.vehicleNumber, {
        vehicleNumber: t.vehicleNumber,
        totalTrips: 1,
        totalIncome: t.income,
        totalExpenses: t.totalExpenses,
        profit: t.profit,
      });
    }
  });
  return Array.from(map.values());
}

export const mockTrips = generateTrips(80);
export const mockVehicles = getVehicleSummaries(mockTrips);
