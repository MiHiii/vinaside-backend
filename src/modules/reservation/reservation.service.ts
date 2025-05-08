import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation, ReservationDocument } from './schemas/reservation.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  createEntity,
  findAllEntity,
  findEntity,
  softDelete,
  updateEntity,
} from '../../utils/db.util';

@Injectable()
export class ReservationService {
  constructor(
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
  ) {}

  async create(createReservationDto: CreateReservationDto, user: JwtPayload) {
    return createEntity<ReservationDocument, CreateReservationDto>(
      'Reservation',
      this.reservationModel,
      createReservationDto,
      user,
    );
  }

  async findAll() {
    return findAllEntity<ReservationDocument>(
      'Reservation',
      this.reservationModel,
    );
  }

  async findOne(id: string) {
    return findEntity<ReservationDocument>(
      'Reservation',
      this.reservationModel,
      id,
    );
  }

  async update(
    id: string,
    updateReservationDto: UpdateReservationDto,
    user: JwtPayload,
  ) {
    return updateEntity<ReservationDocument, UpdateReservationDto>(
      'Reservation',
      this.reservationModel,
      id,
      updateReservationDto,
      user,
    );
  }

  async remove(id: string, user: JwtPayload) {
    return softDelete<ReservationDocument>(
      'Reservation',
      this.reservationModel,
      id,
      user,
    );
  }
}
