import { Model, Types, FilterQuery } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { BaseDocument } from '../interfaces/base-document.interface';

// Check if the provided ID is a valid ObjectId
function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/**
 * Creates a new entity with the provided data and associates it with the user.
 * @param entityName - Optional name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param createData - Data to create the entity
 * @param user - JWT payload containing user information
 * @returns The created entity
 * @throws Error if no data is provided
 */
export async function createEntity<T extends BaseDocument, C>(
  entityName: string,
  model: Model<T>,
  createData: C,
  user: JwtPayload,
): Promise<T> {
  if (!createData || Object.keys(createData).length === 0) {
    throw new Error(`${entityName} creation failed: No data provided`);
  }

  const doc = await model.create({
    ...createData,
    createdBy: user.sub,
  });

  return doc;
}

/**
 * Soft deletes an entity by marking it as deleted.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param id - ID of the entity to delete
 * @param user - JWT payload containing user information
 * @returns The soft-deleted entity
 * @throws NotFoundException if the entity is not found or already deleted
 */
export async function softDelete<T extends BaseDocument>(
  entityName: string,
  model: Model<T>,
  id: string,
  user: JwtPayload,
): Promise<T> {
  if (!isValidObjectId(id)) {
    throw new NotFoundException(`${entityName} not found: Invalid ID`);
  }

  const doc = await model.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user.sub,
    },
    { new: true },
  );

  if (!doc) {
    throw new NotFoundException(`${entityName} not found or already deleted`);
  }

  return doc;
}

/**
 * Updates an entity with the provided data.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param id - ID of the entity to update
 * @param updateData - Data to update the entity
 * @param user - JWT payload containing user information
 * @returns The updated entity
 * @throws NotFoundException if the entity is not found or already deleted
 * @throws Error if no data is provided
 */
export async function updateEntity<T extends BaseDocument, U>(
  entityName: string,
  model: Model<T>,
  id: string,
  updateData: U,
  user: JwtPayload,
): Promise<T> {
  if (!isValidObjectId(id)) {
    throw new NotFoundException(`${entityName} not found: Invalid ID`);
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    throw new Error(`${entityName} update failed: No data provided`);
  }

  const doc = await model.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    {
      ...updateData,
      updatedBy: user.sub,
    },
    { new: true },
  );

  if (!doc) {
    throw new NotFoundException(`${entityName} not found or already deleted`);
  }

  return doc;
}

/**
 * Finds an entity by ID, ensuring it is not soft-deleted.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param id - ID of the entity to find
 * @returns The found entity
 * @throws NotFoundException if the entity is not found or already deleted
 */
export async function findEntity<T extends BaseDocument>(
  entityName: string,
  model: Model<T>,
  id: string,
): Promise<T> {
  if (!isValidObjectId(id)) {
    throw new NotFoundException(`${entityName} not found: Invalid ID`);
  }

  const doc = await model.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  if (!doc) {
    throw new NotFoundException(`${entityName} not found or already deleted`);
  }

  return doc;
}

/**
 * Finds all entities matching the provided query, respecting filter options.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param query - Query to filter entities
 * @param options - Options for pagination, sorting, etc.
 * @returns Array of found entities
 * @throws NotFoundException if no entities are found
 */
export async function findAllEntity<T extends BaseDocument>(
  entityName: string,
  model: Model<T>,
  query: FilterQuery<T> = {},
  options: {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    select?: string;
    populate?: { path: string; select?: string };
    includeDeleted?: boolean;
  } = {},
) {
  const {
    limit,
    skip,
    sort,
    select,
    populate,
    includeDeleted = false,
  } = options;

  let finalQuery = { ...query };
  if (!includeDeleted) {
    finalQuery = { ...finalQuery, isDeleted: { $ne: true } };
  }

  let queryBuilder = model.find(finalQuery);

  if (limit) queryBuilder = queryBuilder.limit(limit);
  if (skip) queryBuilder = queryBuilder.skip(skip);
  if (sort) queryBuilder = queryBuilder.sort(sort);
  if (select) queryBuilder = queryBuilder.select(select);
  if (populate) queryBuilder = queryBuilder.populate(populate);

  const docs = await queryBuilder.exec();

  if (!docs || docs.length === 0) {
    throw new NotFoundException(
      `No ${entityName} found matching your criteria`,
    );
  }

  return docs;
}
