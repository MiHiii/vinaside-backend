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
    createdBy: user._id,
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
      deletedBy: user._id,
    },
    { new: true },
  );

  if (!doc) {
    throw new NotFoundException(`${entityName} not found or already deleted`);
  }

  return doc;
}

/**
 * Restores a soft-deleted entity by marking it as not deleted.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param id - ID of the entity to restore
 * @param user - JWT payload containing user information
 * @returns The restored entity
 * @throws NotFoundException if the entity is not found or not deleted
 */
export async function restoreEntity<T extends BaseDocument>(
  entityName: string,
  model: Model<T>,
  id: string,
  user: JwtPayload,
): Promise<T> {
  if (!isValidObjectId(id)) {
    throw new NotFoundException(`${entityName} not found: Invalid ID`);
  }

  const doc = await model.findOneAndUpdate(
    { _id: id, isDeleted: true },
    {
      isDeleted: false,
      $unset: {
        deletedAt: 1,
        deletedBy: 1,
      },
      updatedBy: user._id,
    },
    { new: true },
  );

  if (!doc) {
    throw new NotFoundException(`${entityName} not found or not deleted`);
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
      updatedBy: user._id,
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

/**
 * Searches entities based on text query across specified fields.
 * @param entityName - Name of the entity for error messages
 * @param model - Mongoose model for the entity
 * @param query - Search query string
 * @param searchFields - Array of field names to search in
 * @param options - Options for pagination, sorting, etc.
 * @param additionalFilters - Additional query filters to apply
 * @returns Array of matching entities
 */
export async function searchEntity<T extends BaseDocument>(
  entityName: string,
  model: Model<T>,
  query: string,
  searchFields: string[],
  options: {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    select?: string;
    populate?: { path: string; select?: string };
    includeDeleted?: boolean;
    caseSensitive?: boolean;
  } = {},
  additionalFilters: FilterQuery<T> = {},
): Promise<T[]> {
  // Return empty array if query is empty or no search fields provided
  if (!query || query.trim() === '' || !searchFields || searchFields.length === 0) {
    return [];
  }

  const {
    limit,
    skip,
    sort,
    select,
    populate,
    includeDeleted = false,
    caseSensitive = false,
  } = options;

  const trimmedQuery = query.trim();
  const regexOptions = caseSensitive ? '' : 'i';

  // Build search conditions for each field
  const searchConditions = searchFields.map(field => ({
    [field]: { $regex: trimmedQuery, $options: regexOptions }
  }));

  // Build search query
  let searchQuery: FilterQuery<T> = {
    $or: searchConditions as unknown as FilterQuery<T>[]
  };

  // Combine with additional filters
  let finalQuery: FilterQuery<T> = {
    $and: [
      searchQuery,
      additionalFilters
    ]
  };

  // Add soft delete filter if needed
  if (!includeDeleted) {
    finalQuery = {
      $and: [
        { isDeleted: { $ne: true } },
        finalQuery
      ]
    };
  }

  let queryBuilder = model.find(finalQuery);

  if (limit) queryBuilder = queryBuilder.limit(limit);
  if (skip) queryBuilder = queryBuilder.skip(skip);
  if (sort) queryBuilder = queryBuilder.sort(sort);
  if (select) queryBuilder = queryBuilder.select(select);
  if (populate) queryBuilder = queryBuilder.populate(populate);

  return queryBuilder.exec();
}
