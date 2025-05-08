// src/companies/companies.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company } from './schema/company.schema';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import {
  createEntity,
  softDelete,
  updateEntity,
  findEntity,
  findAllEntity,
} from 'src/utils/db.util';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<Company>,
  ) {}

  async create(
    createCompanyDto: CreateCompanyDto,
    user: JwtPayload,
  ): Promise<Company> {
    return createEntity<Company, CreateCompanyDto>(
      'Company',
      this.companyModel,
      createCompanyDto,
      user,
    );
  }

  async findAll(): Promise<Company[]> {
    return findAllEntity<Company>(
      'Company',
      this.companyModel,
      {},
      {
        limit: 10,
        skip: 0,
        sort: { createdAt: -1 },
        populate: { path: 'createdBy', select: 'email -_id' },
      },
    );
  }

  async findOne(id: string): Promise<Company> {
    return findEntity<Company>('Company', this.companyModel, id);
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    user: JwtPayload,
  ): Promise<Company> {
    return updateEntity<Company, UpdateCompanyDto>(
      'Company',
      this.companyModel,
      id,
      updateCompanyDto,
      user,
    );
  }

  async remove(id: string, user: JwtPayload): Promise<Company> {
    return softDelete<Company>('Company', this.companyModel, id, user);
  }
}
