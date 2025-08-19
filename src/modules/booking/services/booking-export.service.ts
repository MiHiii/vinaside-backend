import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import { BookingRepo } from '../booking.repo';
import { Booking } from '../schemas/booking.schema';

@Injectable()
export class BookingExportService {
  constructor(private readonly bookingRepo: BookingRepo) {}

  private toCsvRow(values: Array<string | number | undefined | null>): string {
    return (
      values
        .map((v) => {
          if (v === undefined || v === null) return '';
          const s = String(v);
          // Escape CSV: wrap in quotes if contains comma, quote or newline; double quotes inside
          if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(',') + '\n'
    );
  }

  async streamCsv(
    res: Response,
    filter: Partial<{
      from: string;
      to: string;
      status: string;
      paymentStatus: string;
      propertyId: string;
      listingId: string;
    }> = {},
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');

    const model = this.bookingRepo.getModel();

    const query: Record<string, unknown> = { isDeleted: false };
    if (filter.status) query.status = filter.status;
    if (filter.paymentStatus) query['payment_status'] = filter.paymentStatus;
    if (filter.propertyId)
      query['propertyId'] = new Types.ObjectId(filter.propertyId);
    if (filter.listingId)
      query['listingId'] = new Types.ObjectId(filter.listingId);
    if (filter.from || filter.to) {
      const created: Record<string, Date> = {};
      if (filter.from) created.$gte = new Date(filter.from);
      if (filter.to) created.$lte = new Date(filter.to);
      query['created_at'] = created;
    }

    // Header row
    res.write(
      this.toCsvRow([
        'ID',
        'BookingCode',
        'GuestName',
        'GuestEmail',
        'GuestPhone',
        'PropertyId',
        'ListingId',
        'CheckIn',
        'CheckOut',
        'Nights',
        'Guests',
        'Status',
        'PaymentStatus',
        'FinalAmount',
        'CreatedAt',
      ]),
    );

    const cursor = model.find(query).lean().cursor();

    for await (const b of cursor as AsyncIterable<
      Booking & Record<string, any>
    >) {
      const idStr = String(b._id);
      const code = idStr.slice(-8).toUpperCase();
      res.write(
        this.toCsvRow([
          idStr,
          code,
          b.guest_name ?? '',
          b.guest_email ?? '',
          b.guest_phone ?? '',
          (b.propertyId as any)?.toString?.() ?? '',
          (b.listingId as any)?.toString?.() ?? '',
          b.checkInDate ? new Date(b.checkInDate).toISOString() : '',
          b.check_out_date ? new Date(b.check_out_date).toISOString() : '',
          b.nights ?? 0,
          b.guests ?? 0,
          b.status ?? '',
          b.payment_status ?? '',
          b.final_amount ?? 0,
          b.created_at ? new Date(b.created_at).toISOString() : '',
        ]),
      );
    }

    res.end();
  }
}
