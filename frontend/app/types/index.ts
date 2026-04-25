export type User = {
  id: string;
  email: string;
  password: string;
};

export type Walk = {
  id: string;
  start_time: string;
  end_time: string | null;
  active: boolean;
};

export type Location = {
  id: string;
  walk_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};