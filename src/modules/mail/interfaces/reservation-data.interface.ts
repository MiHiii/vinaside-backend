export interface ReservationData {
  id: string;
  userName: string;
  staffEmails?: string[];
  propertyName?: string;
  checkIn: Date | string;
  checkOut: Date | string;
  roomInfo: {
    name: string;
    address?: string;
    image?: string;
  };
  totalPrice: number;
}
