export interface ReservationData {
  id: string;
  userName: string;
  hostName?: string;
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
