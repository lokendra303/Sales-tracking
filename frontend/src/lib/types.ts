export type FollowUp = {
  id: number;
  type: string;
  dueAt: string;
  doneAt: string | null;
  notes: string | null;
  name: string;
  phone: string | null;
  leadId: number | null;
  customerId: number | null;
  overdue: boolean;
};

export type Visit = {
  id: number;
  status: "IN_PROGRESS" | "COMPLETED";
  outcome: "SUCCESS" | "UNAVAILABLE" | null;
  notes: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  placeLat: number | null;
  placeLng: number | null;
  leadId: number | null;
  customerId: number | null;
  userName: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkinLat: number | null;
  checkinLng: number | null;
  distanceMeters: number | null;
  verified: boolean;
  hasPhoto: boolean;
  photoLat: number | null;
  photoLng: number | null;
  photoCapturedAt: string | null;
  photoReceivedAt: string | null;
  managerConfirmedAt: string | null;
  saleAmount: number | null;
  collectionAmount: number | null;
  saleId: number | null;
};

export type Sale = {
  id: number;
  amount: number;
  collectionAmount: number | null;
  note: string | null;
  hasBillPhoto: boolean;
  createdAt: string;
  visitId: number | null;
  userName: string | null;
  name: string;
  phone: string | null;
};

export type FieldTeammate = {
  userId: number;
  name: string;
  phone: string;
  fieldStatus: string;
  lastSeenAt: string | null;
  lastSeenAgeSeconds: number | null;
  liveStreaming: boolean;
  lastLat: number | null;
  lastLng: number | null;
  durationMinutes: number;
};

export type HomeData = {
  todayLeads: number;
  pendingApprovals?: number;
  overdueFollowUps: number;
  todayVisits?: number;
  todaySalesCount?: number;
  todaySalesAmount?: number;
  monthSalesAmount?: number;
  monthTarget?: number;
  targetPercent?: number;
  upcoming?: FollowUp[];
  overdueItems?: FollowUp[];
};

export type Funnel = {
  days: number;
  leads: number;
  visited: number;
  sold: number;
  leadToVisitPercent: number;
  visitToSalePercent: number;
  salesAmount: number;
};

export type TeamPerson = {
  userId: number;
  name: string;
  todayVisits: number;
  todaySalesAmount: number;
  monthSalesAmount: number;
  monthTarget: number;
  targetPercent: number;
  missedStops: number;
  overdueFollowUps: number;
};

export type TeamReport = { year: number; month: number; people: TeamPerson[] };

export type TargetRow = { userId: number; name: string; year: number; month: number; amount: number };
